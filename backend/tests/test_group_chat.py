"""Integration tests for group (team) chat.

Runs against the local dev database using TestClient with a
get_current_user override. All rows created here are cleaned up in the
module fixture's teardown.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.deps import get_current_user
from app.main import app
from app.models.chat_message import ChatMessage
from app.models.chat_thread import ChatThread
from app.models.chat_thread_member import ChatThreadMember
from app.models.user import User

client = TestClient(app)


def _make_user(db, suffix: str, user_type: str, parent_id=None) -> User:
    user = User(
        email=f"grpchat_{suffix}_{uuid.uuid4().hex[:8]}@test.local",
        username=f"grpchat_{suffix}_{uuid.uuid4().hex[:8]}",
        first_name=suffix.capitalize(),
        last_name="Test",
        hashed_password="x" * 60,
        user_type=user_type,
        is_active=True,
        parent_id=parent_id,
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture(scope="module")
def users():
    """One org (admin + 4 agents) and one outsider org (admin + 1 agent)."""
    db = SessionLocal()
    try:
        admin = _make_user(db, "admin", "Admin")
        alice = _make_user(db, "alice", "Agent", parent_id=admin.id)
        bob = _make_user(db, "bob", "Agent", parent_id=admin.id)
        carol = _make_user(db, "carol", "Agent", parent_id=admin.id)
        dave = _make_user(db, "dave", "Agent", parent_id=admin.id)
        other_admin = _make_user(db, "otheradmin", "Admin")
        outsider = _make_user(db, "outsider", "Agent", parent_id=other_admin.id)
        db.commit()

        created = {
            "admin": admin,
            "alice": alice,
            "bob": bob,
            "carol": carol,
            "dave": dave,
            "other_admin": other_admin,
            "outsider": outsider,
        }
        for user in created.values():
            db.refresh(user)
        db.expunge_all()

        yield created
    finally:
        # Teardown: remove everything the tests created, respecting RESTRICT FKs.
        cleanup = SessionLocal()
        try:
            user_ids = [u.id for u in created.values()]
            thread_ids = [
                row[0]
                for row in cleanup.query(ChatThreadMember.thread_id)
                .filter(ChatThreadMember.user_id.in_(user_ids))
                .distinct()
                .all()
            ]
            if thread_ids:
                cleanup.query(ChatMessage).filter(ChatMessage.thread_id.in_(thread_ids)).delete(
                    synchronize_session=False
                )
                cleanup.query(ChatThreadMember).filter(
                    ChatThreadMember.thread_id.in_(thread_ids)
                ).delete(synchronize_session=False)
                cleanup.query(ChatThread).filter(ChatThread.id.in_(thread_ids)).delete(
                    synchronize_session=False
                )
            # Children first (parent_id is SET NULL, but keep it tidy), then admins.
            cleanup.query(User).filter(
                User.id.in_(user_ids), User.parent_id.isnot(None)
            ).delete(synchronize_session=False)
            cleanup.query(User).filter(User.id.in_(user_ids)).delete(synchronize_session=False)
            cleanup.commit()
        finally:
            cleanup.close()
        db.close()
        app.dependency_overrides.pop(get_current_user, None)


def _as(user: User) -> None:
    app.dependency_overrides[get_current_user] = lambda: user


def _create_group(creator: User, member_ids: list, name: str = "Test Group"):
    _as(creator)
    return client.post(
        "/chat/threads",
        json={"member_ids": [str(m) for m in member_ids], "is_group": True, "group_name": name},
    )


# ---------------------------------------------------------------------------
# Group creation
# ---------------------------------------------------------------------------

def test_create_group_with_three_members(users):
    resp = _create_group(users["alice"], [users["bob"].id, users["carol"].id], "Alpha Team")
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["is_group"] is True
    assert body["group_name"] == "Alpha Team"
    assert body["created_by"] == str(users["alice"].id)
    assert len(body["members"]) == 3

    roles = {m["user_id"]: m["role"] for m in body["members"]}
    assert roles[str(users["alice"].id)] == "owner"
    assert roles[str(users["bob"].id)] == "member"
    assert roles[str(users["carol"].id)] == "member"


def test_reject_group_with_one_member(users):
    _as(users["alice"])
    resp = client.post(
        "/chat/threads",
        json={"member_ids": [str(users["bob"].id)], "is_group": True, "group_name": "Too Small"},
    )
    # Pydantic validation rejects groups with fewer than two other members.
    assert resp.status_code == 422, resp.text


def test_reject_group_without_name(users):
    _as(users["alice"])
    resp = client.post(
        "/chat/threads",
        json={"member_ids": [str(users["bob"].id), str(users["carol"].id)], "is_group": True},
    )
    assert resp.status_code == 422, resp.text


def test_reject_non_assignable_participant(users):
    resp = _create_group(users["alice"], [users["bob"].id, users["outsider"].id], "Cross Org")
    assert resp.status_code == 403, resp.text


# ---------------------------------------------------------------------------
# Member management
# ---------------------------------------------------------------------------

@pytest.fixture()
def group(users):
    resp = _create_group(users["alice"], [users["bob"].id, users["carol"].id], "Managed Group")
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_any_member_can_add_participant(users, group):
    _as(users["bob"])  # plain member, not owner
    resp = client.post(
        f"/chat/threads/{group['id']}/members",
        json={"member_ids": [str(users["dave"].id)]},
    )
    assert resp.status_code == 201, resp.text
    member_ids = {m["user_id"] for m in resp.json()["members"]}
    assert str(users["dave"].id) in member_ids

    # A system message documents the addition.
    _as(users["alice"])
    messages = client.get(f"/chat/threads/{group['id']}/messages").json()["messages"]
    assert messages[-1]["message_type"] == "system"
    assert "member_added" in (messages[-1]["message_text"] or "")


def test_reject_adding_existing_member(users, group):
    _as(users["alice"])
    resp = client.post(
        f"/chat/threads/{group['id']}/members",
        json={"member_ids": [str(users["bob"].id)]},
    )
    assert resp.status_code == 400, resp.text


def test_reject_adding_outsider(users, group):
    _as(users["alice"])
    resp = client.post(
        f"/chat/threads/{group['id']}/members",
        json={"member_ids": [str(users["outsider"].id)]},
    )
    assert resp.status_code == 403, resp.text


def test_non_owner_cannot_remove_others(users, group):
    _as(users["bob"])
    resp = client.delete(f"/chat/threads/{group['id']}/members/{users['carol'].id}")
    assert resp.status_code == 403, resp.text


def test_owner_removes_member_and_access_is_revoked(users, group):
    _as(users["alice"])
    resp = client.delete(f"/chat/threads/{group['id']}/members/{users['carol'].id}")
    assert resp.status_code == 200, resp.text
    member_ids = {m["user_id"] for m in resp.json()["members"]}
    assert str(users["carol"].id) not in member_ids

    # Removed member can no longer read the thread.
    _as(users["carol"])
    resp = client.get(f"/chat/threads/{group['id']}/messages")
    assert resp.status_code == 403, resp.text


def test_member_can_leave(users, group):
    _as(users["bob"])
    resp = client.delete(f"/chat/threads/{group['id']}/members/{users['bob'].id}")
    assert resp.status_code == 200, resp.text
    member_ids = {m["user_id"] for m in resp.json()["members"]}
    assert str(users["bob"].id) not in member_ids


def test_owner_cannot_leave_while_others_remain(users, group):
    _as(users["alice"])
    resp = client.delete(f"/chat/threads/{group['id']}/members/{users['alice'].id}")
    assert resp.status_code == 400, resp.text


def test_non_member_cannot_read_messages(users, group):
    _as(users["dave"])  # dave is not in this fresh group fixture
    resp = client.get(f"/chat/threads/{group['id']}/messages")
    assert resp.status_code == 403, resp.text


# ---------------------------------------------------------------------------
# Rename
# ---------------------------------------------------------------------------

def test_only_owner_can_rename(users, group):
    _as(users["bob"])
    resp = client.patch(f"/chat/threads/{group['id']}", json={"group_name": "Hijacked"})
    assert resp.status_code == 403, resp.text

    _as(users["alice"])
    resp = client.patch(f"/chat/threads/{group['id']}", json={"group_name": "Renamed Group"})
    assert resp.status_code == 200, resp.text
    assert resp.json()["group_name"] == "Renamed Group"

    messages = client.get(f"/chat/threads/{group['id']}/messages").json()["messages"]
    assert messages[-1]["message_type"] == "system"
    assert "renamed" in (messages[-1]["message_text"] or "")


# ---------------------------------------------------------------------------
# Messaging in groups + direct-thread regression
# ---------------------------------------------------------------------------

def test_group_messaging_visible_to_all_members(users, group):
    _as(users["bob"])
    resp = client.post(
        f"/chat/threads/{group['id']}/messages",
        json={"message_text": "Hello team"},
    )
    assert resp.status_code == 201, resp.text

    _as(users["carol"])
    messages = client.get(f"/chat/threads/{group['id']}/messages").json()["messages"]
    assert any(m["message_text"] == "Hello team" for m in messages)


def test_direct_thread_find_or_create_still_dedupes(users):
    _as(users["alice"])
    first = client.post(
        "/chat/threads", json={"member_ids": [str(users["bob"].id)], "is_group": False}
    )
    second = client.post(
        "/chat/threads", json={"member_ids": [str(users["bob"].id)], "is_group": False}
    )
    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["id"] == second.json()["id"]


def test_direct_thread_cannot_chat_across_orgs(users):
    _as(users["alice"])
    resp = client.post(
        "/chat/threads", json={"member_ids": [str(users["outsider"].id)], "is_group": False}
    )
    assert resp.status_code == 403, resp.text
