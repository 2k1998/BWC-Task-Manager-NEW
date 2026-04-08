from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.core.security import decode_token
from app.models.chat_message import ChatMessage
from app.models.chat_thread import ChatThread
from app.models.user import User
from app.schemas.chat import (
    ChatMessageListResponse,
    ChatMessageResponse,
    ChatThreadDetailResponse,
    ChatThreadItemResponse,
    ChatThreadListResponse,
    CreateMessageRequest,
    CreateThreadRequest,
)
from app.utils.connection_manager import connection_manager

router = APIRouter(prefix="/chat", tags=["Chat"])


def _thread_item_from_thread(
    thread: ChatThread,
    last_message: ChatMessage | None,
    unread_count: int,
) -> ChatThreadItemResponse:
    preview: str | None
    if last_message is None:
        preview = None
    elif last_message.message_text is not None and last_message.message_text.strip() != "":
        preview = last_message.message_text
    elif last_message.file_id is not None:
        preview = "Attachment"
    else:
        preview = None

    return ChatThreadItemResponse(
        id=thread.id,
        user_one_id=thread.user_one_id,
        user_two_id=thread.user_two_id,
        created_at=thread.created_at,
        last_message_preview=preview,
        unread_count=unread_count,
    )


def _serialize_chat_message(message: ChatMessage) -> dict:
    return {
        "id": str(message.id),
        "thread_id": str(message.thread_id),
        "sender_user_id": str(message.sender_user_id),
        "message_text": message.message_text,
        "file_id": str(message.file_id) if message.file_id is not None else None,
        "is_read": message.is_read,
        "created_at": message.created_at.isoformat() if message.created_at else None,
    }


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


@router.get("/threads", response_model=ChatThreadListResponse)
def list_threads(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    threads_q = db.query(ChatThread).filter(
        sa.or_(
            ChatThread.user_one_id == current_user.id,
            ChatThread.user_two_id == current_user.id,
        )
    )
    total = threads_q.count()
    threads = threads_q.all()

    if not threads:
        return ChatThreadListResponse(threads=[], total=0, page=page, page_size=page_size)

    thread_ids = [t.id for t in threads]

    # Latest message per thread (single query).
    latest_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.thread_id.in_(thread_ids))
        .order_by(ChatMessage.thread_id, ChatMessage.created_at.desc())
        .distinct(ChatMessage.thread_id)
        .all()
    )
    last_by_thread: dict[UUID, ChatMessage] = {m.thread_id: m for m in latest_messages}

    # Unread count for current user (single grouped query).
    unread_rows = (
        db.query(ChatMessage.thread_id, sa.func.count(ChatMessage.id))
        .filter(
            ChatMessage.thread_id.in_(thread_ids),
            ChatMessage.sender_user_id != current_user.id,
            ChatMessage.is_read.is_(False),
        )
        .group_by(ChatMessage.thread_id)
        .all()
    )
    unread_by_thread: dict[UUID, int] = {row[0]: int(row[1]) for row in unread_rows}

    # Sort by latest message time (or thread.created_at when empty).
    items_with_sort_key: list[tuple[datetime, ChatThreadItemResponse]] = []
    for t in threads:
        last_msg = last_by_thread.get(t.id)
        last_ts = last_msg.created_at if last_msg else t.created_at
        item = _thread_item_from_thread(
            thread=t,
            last_message=last_msg,
            unread_count=unread_by_thread.get(t.id, 0),
        )
        items_with_sort_key.append((last_ts, item))

    items_with_sort_key.sort(key=lambda x: x[0], reverse=True)
    start = (page - 1) * page_size
    end = start + page_size
    paged = [item for _, item in items_with_sort_key[start:end]]

    return ChatThreadListResponse(threads=paged, total=total, page=page, page_size=page_size)


@router.get("/threads/{id}", response_model=ChatThreadDetailResponse)
def get_thread(
    id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        thread_uuid = UUID(id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid thread id")

    thread = db.query(ChatThread).filter(ChatThread.id == thread_uuid).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    is_participant = str(thread.user_one_id) == str(current_user.id) or str(thread.user_two_id) == str(current_user.id)
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    messages_q = db.query(ChatMessage).filter(ChatMessage.thread_id == thread_uuid).order_by(ChatMessage.created_at.desc())
    total = messages_q.count()
    messages = messages_q.offset((page - 1) * page_size).limit(page_size).all()

    last_message = db.query(ChatMessage).filter(ChatMessage.thread_id == thread_uuid).order_by(ChatMessage.created_at.desc()).first()
    unread_count = (
        db.query(sa.func.count(ChatMessage.id))
        .filter(
            ChatMessage.thread_id == thread_uuid,
            ChatMessage.sender_user_id != current_user.id,
            ChatMessage.is_read.is_(False),
        )
        .scalar()
    )

    thread_item = _thread_item_from_thread(
        thread=thread,
        last_message=last_message,
        unread_count=int(unread_count or 0),
    )

    return ChatThreadDetailResponse(
        thread=thread_item,
        messages=[
            ChatMessageResponse(
                id=m.id,
                thread_id=m.thread_id,
                sender_user_id=m.sender_user_id,
                message_text=m.message_text,
                file_id=m.file_id,
                is_read=m.is_read,
                created_at=m.created_at,
            )
            for m in messages
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/threads", response_model=ChatThreadItemResponse, status_code=status.HTTP_201_CREATED)
def create_or_get_thread(
    data: CreateThreadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if str(data.other_user_id) == str(current_user.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot create a thread with yourself")

    user_one_id = min(current_user.id, data.other_user_id)
    user_two_id = max(current_user.id, data.other_user_id)

    thread = (
        db.query(ChatThread)
        .filter(ChatThread.user_one_id == user_one_id, ChatThread.user_two_id == user_two_id)
        .first()
    )

    if not thread:
        thread = ChatThread(user_one_id=user_one_id, user_two_id=user_two_id)
        db.add(thread)
        db.commit()
        db.refresh(thread)

    return _thread_item_from_thread(thread=thread, last_message=None, unread_count=0)


@router.post("/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    data: CreateMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = db.query(ChatThread).filter(ChatThread.id == data.thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    is_participant = str(thread.user_one_id) == str(current_user.id) or str(thread.user_two_id) == str(current_user.id)
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    message_text = data.message_text
    if message_text is not None and message_text.strip() == "":
        message_text = None

    message = ChatMessage(
        thread_id=data.thread_id,
        sender_user_id=current_user.id,
        message_text=message_text,
        file_id=data.file_id,
        is_read=False,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    await connection_manager.broadcast_to_thread(
        thread_id=str(message.thread_id),
        payload={
            "type": "new_message",
            "message": _serialize_chat_message(message),
        },
    )

    return ChatMessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender_user_id=message.sender_user_id,
        message_text=message.message_text,
        file_id=message.file_id,
        is_read=message.is_read,
        created_at=message.created_at,
    )


@router.patch("/messages/{id}/read", response_model=ChatMessageResponse)
async def mark_message_read(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        msg_uuid = UUID(id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid message id")

    message = db.query(ChatMessage).filter(ChatMessage.id == msg_uuid).first()
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    thread = db.query(ChatThread).filter(ChatThread.id == message.thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    is_participant = str(thread.user_one_id) == str(current_user.id) or str(thread.user_two_id) == str(current_user.id)
    if not is_participant:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have access to this thread")

    # PRD semantics: mark read is for the non-sender recipient.
    if str(message.sender_user_id) == str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sender cannot mark their own message as read")

    if message.is_read is False:
        message.is_read = True
        db.add(message)
        db.commit()
        db.refresh(message)

    await connection_manager.broadcast_to_thread(
        thread_id=str(message.thread_id),
        payload={
            "type": "read_receipt",
            "message_id": str(message.id),
            "reader_user_id": str(current_user.id),
        },
    )

    return ChatMessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender_user_id=message.sender_user_id,
        message_text=message.message_text,
        file_id=message.file_id,
        is_read=message.is_read,
        created_at=message.created_at,
    )


@router.websocket("/ws/chat/{thread_id}")
async def ws_chat(websocket: WebSocket, thread_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db: Session = SessionLocal()
    user: User | None = None
    thread: ChatThread | None = None

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

        thread = db.query(ChatThread).filter(ChatThread.id == thread_uuid).first()
        if not thread:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        is_participant = str(thread.user_one_id) == str(user.id) or str(thread.user_two_id) == str(user.id)
        if not is_participant:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id_str = str(user.id)
        await connection_manager.connect_chat(thread_id=str(thread.id), user_id=user_id_str, websocket=websocket)

        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue

            event_type = data.get("type")
            if event_type != "typing":
                continue

            is_typing = bool(data.get("is_typing", True))
            typing_payload = {
                "type": "typing",
                "thread_id": str(thread.id),
                "user_id": user_id_str,
                "is_typing": is_typing,
            }
            await connection_manager.broadcast_typing(
                thread_id=str(thread.id),
                typing_payload=typing_payload,
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

