from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ConversationListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: Optional[str] = None
    updated_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(
        ...,
        min_length=1,
        max_length=settings.CHATBOT_MAX_USER_MESSAGE_CHARS,
    )


class MessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    content: Optional[str] = None
    tool_name: Optional[str] = None
    created_at: datetime
