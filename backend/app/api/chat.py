from __future__ import annotations

import json
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.models.chat_message import ChatMessage
from app.models.chat_thread import ChatThread
from app.models.chat_thread_member import ChatThreadMember
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.chat import (
    AddMembersRequest,
    ApprovalRequestCreate,
    ApprovalStatusPatch,
    ChatMessageListResponse,
    ChatMessageResponse,
    ChatThreadListResponse,
    ChatThreadMemberResponse,
    ChatThreadResponse,
    CreateMessageRequest,
    CreateThreadRequest,
    RenameThreadRequest,
)
from app.utils.connection_manager import connection_manager
from app.utils.hierarchy import get_assignable_user_ids

router = APIRouter(prefix="/chat", tags=["Chat"])

ROLE_OWNER = "owner"
ROLE_MEMBER = "member"


def _get_user_from_token(db: Session, token: str) -> User | None:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        return None
    return user


def _get_membership(db: Session, thread_id: UUID, user_id: UUID) -> ChatThreadMember | None:
    return (
        db.query(ChatThreadMember)
        .filter(
            ChatThreadMember.thread_id == thread_id,
            ChatThreadMember.user_id == user_id,
        )
        .first()
    )


def _is_thread_member(db: Session, thread_id: UUID, user_id: UUID) -> bool:
    return _get_membership(db, thread_id, user_id) is not None


def _display_name(user: User) -> str:
    named = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
    return named or (user.email or "Unknown user")


def _serialize_chat_message(message: ChatMessage) -> dict:
    return {
        "id": str(message.id),
        "thread_id": str(message.thread_id),
        "sender_user_id": str(message.sender_user_id),
        "message_text": message.message_text,
        "file_id": str(message.file_id) if message.file_id else None,
        "message_type": message.message_type,
        "approval_status": message.approval_status,
        "is_read": message.is_read,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


def _message_response(message: ChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender_user_id=message.sender_user_id,
        message_text=message.message_text,
        file_id=message.file_id,
        message_type=message.message_type or "text",
        approval_status=message.approval_status,
        is_read=message.is_read,
        created_at=message.created_at,
    )


def _create_system_message(
    db: Session, thread_id: UUID, actor_id: UUID, event: str, **data
) -> ChatMessage:
    """Insert a machine-readable system message (frontend translates the event).

    Caller owns the transaction and the WebSocket broadcast.
    """
    message = ChatMessage(
        thread_id=thread_id,
        sender_user_id=actor_id,
        message_text=json.dumps({"event": event, **data}),
        message_type="system",
        approval_status=None,
        is_read=False,
    )
    db.add(message)
    return message


async def _broadcast_message(message: ChatMessage) -> None:
    await connection_manager.broadcast_to_thread(
        thread_id=str(message.thread_id),
        payload={"type": "new_message", "message": _serialize_chat_message(message)},
    )


def _thread_members(db: Session, thread_id: UUID) -> list[ChatThreadMemberResponse]:
    rows = (
        db.query(
            User.id,
            User.first_name,
            User.last_name,
            User.email,
            ChatThreadMember.role,
            UserProfile.profile_photo_url,
        )
        .join(ChatThreadMember, ChatThreadMember.user_id == User.id)
        .outerjoin(UserProfile, UserProfile.user_id == User.id)
        .filter(ChatThreadMember.thread_id == thread_id)
        .order_by(User.first_name.asc(), User.last_name.asc())
        .all()
    )
    return [
        ChatThreadMemberResponse(
            user_id=row[0],
            first_name=row[1],
            last_name=row[2],
            email=row[3],
            role=row[4] or ROLE_MEMBER,
            profile_photo_url=row[5],
        )
        for row in rows
    ]


def _thread_response(db: Session, thread: ChatThread) -> ChatThreadResponse:
    return ChatThreadResponse(
        id=thread.id,
        is_group=thread.is_group,
        group_name=thread.group_name,
        created_by=thread.created_by,
        created_at=thread.created_at,
        members=_thread_members(db, thread.id),
    )


def _get_group_thread_or_404(db: Session, thread_id: UUID) -> ChatThread:
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    if not thread.is_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This operation is only available for group threads",
        )
    return thread


def _validate_participants(
    db: Session, current_user: User, member_ids: set[UUID]
) -> None:
    """Participants must exist, be active, and share the caller's organization."""
    if not member_ids:
        return
    assignable = set(get_assignable_user_ids(current_user, db))
    if not member_ids.issubset(assignable):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only chat with members of your organization",
        )
    active_ids = {
        row[0]
        for row in db.query(User.id)
        .filter(User.id.in_(list(member_ids)), User.is_active.is_(True))
        .all()
    }
    if active_ids != member_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more members do not exist or are inactive",
        )


@router.post("/threads", response_model=ChatThreadResponse, status_code=status.HTTP_201_CREATED)
def create_thread(
    payload: CreateThreadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unique_member_ids = {member_id for member_id in payload.member_ids if member_id != current_user.id}
    if not payload.is_group and len(unique_member_ids) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Direct threads require exactly one other member",
        )
    if payload.is_group and len(unique_member_ids) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group threads require at least two other members",
        )

    _validate_participants(db, current_user, unique_member_ids)

    if not payload.is_group:
        other_user_id = next(iter(unique_member_ids))
        existing_threads = (
            db.query(ChatThread.id)
            .join(ChatThreadMember, ChatThreadMember.thread_id == ChatThread.id)
            .filter(ChatThread.is_group.is_(False), ChatThreadMember.user_id.in_([current_user.id, other_user_id]))
            .group_by(ChatThread.id)
            .having(sa.func.count(sa.distinct(ChatThreadMember.user_id)) == 2)
            .all()
        )
        if existing_threads:
            existing_id = existing_threads[0][0]
            existing_thread = db.query(ChatThread).filter(ChatThread.id == existing_id).first()
            if existing_thread:
                return _thread_response(db, existing_thread)

    thread = ChatThread(
        is_group=payload.is_group,
        group_name=payload.group_name.strip() if payload.group_name else None,
        created_by=current_user.id,
    )
    db.add(thread)
    db.flush()

    db.add(ChatThreadMember(thread_id=thread.id, user_id=current_user.id, role=ROLE_OWNER))
    for member_id in unique_member_ids:
        db.add(ChatThreadMember(thread_id=thread.id, user_id=member_id, role=ROLE_MEMBER))

    db.commit()
    db.refresh(thread)
    return _thread_response(db, thread)


@router.get("/threads", response_model=ChatThreadListResponse)
def list_threads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    threads = (
        db.query(ChatThread)
        .join(ChatThreadMember, ChatThreadMember.thread_id == ChatThread.id)
        .filter(ChatThreadMember.user_id == current_user.id)
        .order_by(ChatThread.created_at.desc())
        .all()
    )
    return ChatThreadListResponse(threads=[_thread_response(db, thread) for thread in threads])


@router.post(
    "/threads/{thread_id}/members",
    response_model=ChatThreadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_thread_members(
    thread_id: UUID,
    payload: AddMembersRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_thread_member(db, thread_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    thread = _get_group_thread_or_404(db, thread_id)

    new_member_ids = {member_id for member_id in payload.member_ids if member_id != current_user.id}
    if not new_member_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No members to add")

    existing_ids = {
        row[0]
        for row in db.query(ChatThreadMember.user_id)
        .filter(ChatThreadMember.thread_id == thread_id, ChatThreadMember.user_id.in_(list(new_member_ids)))
        .all()
    }
    if existing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more users are already members of this group",
        )

    _validate_participants(db, current_user, new_member_ids)

    added_users = db.query(User).filter(User.id.in_(list(new_member_ids))).all()
    for member_id in new_member_ids:
        db.add(ChatThreadMember(thread_id=thread_id, user_id=member_id, role=ROLE_MEMBER))

    system_message = _create_system_message(
        db,
        thread_id,
        current_user.id,
        "member_added",
        actor=_display_name(current_user),
        targets=[_display_name(u) for u in added_users],
    )
    db.commit()
    db.refresh(system_message)

    await _broadcast_message(system_message)
    return _thread_response(db, thread)


@router.delete("/threads/{thread_id}/members/{user_id}", response_model=ChatThreadResponse)
async def remove_thread_member(
    thread_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actor_membership = _get_membership(db, thread_id, current_user.id)
    if not actor_membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    thread = _get_group_thread_or_404(db, thread_id)

    is_self = user_id == current_user.id
    if is_self:
        target_membership = actor_membership
    else:
        if actor_membership.role != ROLE_OWNER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the group owner can remove other members",
            )
        target_membership = _get_membership(db, thread_id, user_id)
        if not target_membership:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a member of this group")

    member_count = (
        db.query(sa.func.count(ChatThreadMember.id))
        .filter(ChatThreadMember.thread_id == thread_id)
        .scalar()
    )
    if is_self and actor_membership.role == ROLE_OWNER and member_count > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The group owner cannot leave while other members remain",
        )

    target_user = db.query(User).filter(User.id == user_id).first()
    db.delete(target_membership)

    if is_self:
        system_message = _create_system_message(
            db, thread_id, current_user.id, "member_left",
            actor=_display_name(current_user),
        )
    else:
        system_message = _create_system_message(
            db, thread_id, current_user.id, "member_removed",
            actor=_display_name(current_user),
            targets=[_display_name(target_user)] if target_user else [],
        )
    db.commit()
    db.refresh(system_message)

    await _broadcast_message(system_message)
    await connection_manager.kick_user_from_thread(thread_id=str(thread_id), user_id=str(user_id))
    return _thread_response(db, thread)


@router.patch("/threads/{thread_id}", response_model=ChatThreadResponse)
async def rename_thread(
    thread_id: UUID,
    payload: RenameThreadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = _get_membership(db, thread_id, current_user.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")
    if membership.role != ROLE_OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the group owner can rename the group",
        )

    thread = _get_group_thread_or_404(db, thread_id)
    thread.group_name = payload.group_name

    system_message = _create_system_message(
        db, thread_id, current_user.id, "renamed",
        actor=_display_name(current_user),
        name=payload.group_name,
    )
    db.add(thread)
    db.commit()
    db.refresh(system_message)
    db.refresh(thread)

    await _broadcast_message(system_message)
    return _thread_response(db, thread)


@router.get("/threads/{thread_id}/messages", response_model=ChatMessageListResponse)
def list_thread_messages(
    thread_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_thread_member(db, thread_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.thread_id == thread_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return ChatMessageListResponse(messages=[_message_response(message) for message in messages])


@router.post("/threads/{thread_id}/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_thread_message(
    thread_id: UUID,
    payload: CreateMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_thread_member(db, thread_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    message = ChatMessage(
        thread_id=thread_id,
        sender_user_id=current_user.id,
        message_text=payload.message_text.strip() if payload.message_text else None,
        message_type=(payload.message_type or "text").strip() or "text",
        file_id=payload.file_id,
        approval_status=None,
        is_read=False,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    await _broadcast_message(message)
    return _message_response(message)


@router.post("/threads/{thread_id}/approval-request", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_request(
    thread_id: UUID,
    payload: ApprovalRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_thread_member(db, thread_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    message = ChatMessage(
        thread_id=thread_id,
        sender_user_id=current_user.id,
        message_text=f"{payload.request_type}|{payload.title}|{payload.description}",
        message_type="approval",
        approval_status="pending",
        is_read=False,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    await _broadcast_message(message)
    return _message_response(message)


@router.patch("/messages/{message_id}/approval", response_model=ChatMessageResponse)
async def patch_approval_status(
    message_id: UUID,
    payload: ApprovalStatusPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if str(message.sender_user_id) == str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sender cannot approve their own request")

    if not _is_thread_member(db, message.thread_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    message.approval_status = payload.status
    db.add(message)
    db.commit()
    db.refresh(message)

    await connection_manager.broadcast_to_thread(
        thread_id=str(message.thread_id),
        payload={"type": "message_updated", "message": _serialize_chat_message(message)},
    )

    return _message_response(message)


@router.websocket("/ws/chat/{thread_id}")
async def ws_chat(websocket: WebSocket, thread_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db: Session = SessionLocal()
    try:
        await websocket.accept()

        user = _get_user_from_token(db=db, token=token)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        try:
            thread_uuid = UUID(thread_id)
        except Exception:
            await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
            return

        if not _is_thread_member(db, thread_uuid, user.id):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id_str = str(user.id)
        await connection_manager.connect_chat(thread_id=str(thread_uuid), user_id=user_id_str, websocket=websocket)

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue

            if data.get("type") != "typing":
                continue

            await connection_manager.broadcast_typing(
                thread_id=str(thread_uuid),
                typing_payload={
                    "type": "typing",
                    "thread_id": str(thread_uuid),
                    "user_id": user_id_str,
                    "is_typing": bool(data.get("is_typing", True)),
                },
                exclude_user_id=user_id_str,
            )

    except WebSocketDisconnect:
        pass
    finally:
        try:
            await connection_manager.disconnect_chat(websocket=websocket)
        except Exception:
            pass
        db.close()
