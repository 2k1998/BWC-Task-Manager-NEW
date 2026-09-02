from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from uuid import UUID


class ChatThreadMemberResponse(BaseModel):
    user_id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role: str = "member"
    profile_photo_url: Optional[str] = None


class ChatThreadResponse(BaseModel):
    id: UUID
    is_group: bool
    group_name: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    members: List[ChatThreadMemberResponse]


class ChatThreadListResponse(BaseModel):
    threads: List[ChatThreadResponse]


class ChatMessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    sender_user_id: UUID
    message_text: Optional[str] = None
    file_id: Optional[UUID] = None
    message_type: str = "text"
    approval_status: Optional[str] = None
    is_read: bool
    created_at: datetime


class ChatMessageListResponse(BaseModel):
    messages: List[ChatMessageResponse]


class CreateThreadRequest(BaseModel):
    member_ids: List[UUID] = Field(default_factory=list)
    is_group: bool = False
    group_name: Optional[str] = None

    @model_validator(mode="after")
    def validate_group_requirements(self):
        unique_members = list(dict.fromkeys(self.member_ids))
        self.member_ids = unique_members
        if self.is_group:
            if self.group_name is None or self.group_name.strip() == "":
                raise ValueError("group_name is required when is_group is true")
            if len(self.member_ids) < 2:
                raise ValueError("Group threads require at least two other members")
        elif len(self.member_ids) != 1:
            raise ValueError("Direct threads require exactly one member_id")
        return self


class AddMembersRequest(BaseModel):
    member_ids: List[UUID] = Field(..., min_length=1)

    @model_validator(mode="after")
    def dedupe_members(self):
        self.member_ids = list(dict.fromkeys(self.member_ids))
        return self


class RenameThreadRequest(BaseModel):
    group_name: str = Field(..., min_length=1, max_length=200)

    @model_validator(mode="after")
    def validate_not_blank(self):
        if self.group_name.strip() == "":
            raise ValueError("group_name cannot be blank")
        self.group_name = self.group_name.strip()
        return self


class CreateMessageRequest(BaseModel):
    message_text: Optional[str] = None
    message_type: str = "text"
    file_id: Optional[UUID] = None

    @model_validator(mode="after")
    def validate_message_has_content(self):
        has_text = self.message_text is not None and self.message_text.strip() != ""
        if not has_text and self.file_id is None:
            raise ValueError("A message requires `message_text` or `file_id`")
        if self.message_type.strip() == "":
            raise ValueError("`message_type` cannot be blank")
        return self


class ApprovalRequestCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    request_type: str = Field(..., min_length=1)


class ApprovalStatusPatch(BaseModel):
    status: Literal["approved", "declined"]
