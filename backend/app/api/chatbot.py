from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.chatbot import (
    ConversationListItem,
    ConversationRead,
    MessageCreate,
    MessageRead,
)
from app.services import chatbot as chatbot_service

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])


@router.post("/conversations", response_model=ConversationRead, status_code=status.HTTP_201_CREATED)
def create_conversation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chatbot_service.create_conversation(current_user, db)


@router.get("/conversations", response_model=list[ConversationListItem])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chatbot_service.list_conversations(current_user, db)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageRead])
def list_messages(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chatbot_service.list_messages(conversation_id, current_user, db)


@router.post("/conversations/{conversation_id}/messages", response_model=MessageRead)
def send_message(
    conversation_id: UUID,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chatbot_service.send_message(
        conversation_id,
        payload.content,
        current_user,
        db,
    )
