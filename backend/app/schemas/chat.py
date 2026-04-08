from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ChatThreadItemResponse(BaseModel):
    id: UUID
    user_one_id: UUID
    user_two_id: UUID
    created_at: datetime
    last_message_preview: Optional[str] = None
    unread_count: int = 0


class ChatThreadListResponse(BaseModel):
    threads: List[ChatThreadItemResponse]
    total: int
    page: int
    page_size: int


class ChatThreadDetailResponse(BaseModel):
    thread: ChatThreadItemResponse
    messages: List["ChatMessageResponse"]
    total: int
    page: int
    page_size: int


class ChatMessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    sender_user_id: UUID
    message_text: Optional[str] = None
    file_id: Optional[UUID] = None
    is_read: bool
    created_at: datetime


class ChatMessageListResponse(BaseModel):
    messages: List[ChatMessageResponse]
    total: int
    page: int
    page_size: int


class CreateThreadRequest(BaseModel):
    other_user_id: UUID


class CreateMessageRequest(BaseModel):
    thread_id: UUID
    message_text: Optional[str] = None
    file_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validate_message_has_content(self):
        if (self.message_text is None or self.message_text.strip() == "") and self.file_id is None:
            raise ValueError("Either `message_text` or `file_id` must be provided")
        return self

