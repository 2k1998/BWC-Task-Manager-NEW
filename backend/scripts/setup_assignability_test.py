"""
Re-parent the phase8 test agent under a non-Admin chain for assignability E2E tests.

Usage (from backend/):
    .venv\\Scripts\\python scripts/setup_assignability_test.py setup
    .venv\\Scripts\\python scripts/setup_assignability_test.py restore
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.page import Page
from app.models.permission import UserPagePermission, UserPermission
from app.models.user import User
from app.utils.hierarchy import get_assignable_user_ids, get_descendant_ids, get_organization_admin

TEST_AGENT_EMAIL = "phase8_test@example.com"
STATE_FILE = Path(__file__).parent / ".assignability_test_state.json"
CANDIDATE_TYPES = ("Pillar", "Manager", "Head")


def _full_name(user: User) -> str:
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email


def _subtree_size(user_id, db) -> int:
    return 1 + len(get_descendant_ids(user_id, db))


def _assignable_count(agent: User, db) -> int:
    return len(get_assignable_user_ids(agent, db))


def _pick_candidate(agent: User, db) -> User | None:
    """Pick parent with largest subtree; prefer candidates yielding assignable count > 1."""
    candidates = (
        db.query(User)
        .filter(
            User.is_active == True,
            User.user_type.in_(CANDIDATE_TYPES),
            User.id != agent.id,
        )
        .all()
    )
    if not candidates:
        return None

    # Sort by subtree size descending, then by depth (Head > Manager > Pillar preference for deeper chains)
    type_rank = {"Head": 0, "Manager": 1, "Pillar": 2}

    def sort_key(u: User) -> tuple:
        return (-_subtree_size(u.id, db), type_rank.get(u.user_type, 9), u.email)

    ordered = sorted(candidates, key=sort_key)

    best: User | None = None
    best_count = 0
    for candidate in ordered:
        original_parent = agent.parent_id
        agent.parent_id = candidate.id
        db.flush()
        count = _assignable_count(agent, db)
        agent.parent_id = original_parent
        db.flush()
        if count > best_count:
            best_count = count
            best = candidate
        if count > 1:
            return candidate

    return best


def setup() -> int:
    db = SessionLocal()
    try:
        agent = db.query(User).filter(User.email == TEST_AGENT_EMAIL).first()
        if not agent:
            print(f"ERROR: test agent {TEST_AGENT_EMAIL} not found", file=sys.stderr)
            return 1

        candidate = _pick_candidate(agent, db)
        if not candidate:
            print("ERROR: no suitable parent candidate found", file=sys.stderr)
            return 1

        perm = (
            db.query(UserPermission)
            .filter(UserPermission.user_id == agent.id, UserPermission.module == "tasks")
            .first()
        )
        original_tasks_access = perm.access_level if perm else "none"

        companies_page = db.query(Page).filter(Page.key == "companies").first()
        page_perm = None
        if companies_page:
            page_perm = (
                db.query(UserPagePermission)
                .filter(
                    UserPagePermission.user_id == agent.id,
                    UserPagePermission.page_id == companies_page.id,
                )
                .first()
            )

        state = {
            "test_agent_id": str(agent.id),
            "original_parent_id": str(agent.parent_id) if agent.parent_id else None,
            "new_parent_id": str(candidate.id),
            "new_parent_email": candidate.email,
            "new_parent_role": candidate.user_type,
            "new_parent_full_name": _full_name(candidate),
            "original_tasks_access": original_tasks_access,
            "had_tasks_permission_row": perm is not None,
            "original_companies_page_access": page_perm.access if page_perm else None,
            "had_companies_page_permission_row": page_perm is not None,
        }

        agent.parent_id = candidate.id
        if perm:
            perm.access_level = "edit"
        else:
            db.add(
                UserPermission(
                    user_id=agent.id,
                    module="tasks",
                    access_level="edit",
                )
            )
        if companies_page:
            if page_perm:
                page_perm.access = "read"
            else:
                db.add(
                    UserPagePermission(
                        user_id=agent.id,
                        page_id=companies_page.id,
                        access="read",
                    )
                )
        db.commit()
        db.refresh(agent)

        org_admin = get_organization_admin(agent, db)
        assignable = get_assignable_user_ids(agent, db)
        state["org_admin_email"] = org_admin.email if org_admin else None
        state["org_admin_role"] = org_admin.user_type if org_admin else None
        state["assignable_count"] = len(assignable)

        STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")
        print(json.dumps(state, indent=2))
        print(
            f"\nOrganization admin: {org_admin.email if org_admin else 'None'} "
            f"({org_admin.user_type if org_admin else 'N/A'}), "
            f"assignable count: {len(assignable)}"
        )
        if len(assignable) <= 1:
            print(
                "WARNING: assignable count is 1 — local DB may have only one user in branch",
                file=sys.stderr,
            )
        return 0
    finally:
        db.close()


def restore() -> int:
    if not STATE_FILE.exists():
        print("ERROR: state file missing — run setup first", file=sys.stderr)
        return 1

    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    db = SessionLocal()
    try:
        agent = db.query(User).filter(User.id == state["test_agent_id"]).first()
        if not agent:
            print("ERROR: test agent not found for restore", file=sys.stderr)
            return 1

        original = state["original_parent_id"]
        agent.parent_id = original if original else None

        perm = (
            db.query(UserPermission)
            .filter(UserPermission.user_id == agent.id, UserPermission.module == "tasks")
            .first()
        )
        if state.get("had_tasks_permission_row"):
            if perm:
                perm.access_level = state.get("original_tasks_access", "view")
        elif perm:
            db.delete(perm)

        companies_page = db.query(Page).filter(Page.key == "companies").first()
        if companies_page:
            page_perm = (
                db.query(UserPagePermission)
                .filter(
                    UserPagePermission.user_id == agent.id,
                    UserPagePermission.page_id == companies_page.id,
                )
                .first()
            )
            if state.get("had_companies_page_permission_row"):
                if page_perm and state.get("original_companies_page_access"):
                    page_perm.access = state["original_companies_page_access"]
            elif page_perm:
                db.delete(page_perm)

        db.commit()
        STATE_FILE.unlink(missing_ok=True)
        print(f"Restored {TEST_AGENT_EMAIL} parent_id to {original}")
        return 0
    finally:
        db.close()


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in ("setup", "restore"):
        print("Usage: python scripts/setup_assignability_test.py [setup|restore]", file=sys.stderr)
        sys.exit(1)
    mode = sys.argv[1]
    rc = setup() if mode == "setup" else restore()
    sys.exit(rc)


if __name__ == "__main__":
    main()
