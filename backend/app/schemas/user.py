from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


# Allowed user types (application-level validation)
ALLOWED_USER_TYPES = ["Agent", "Head", "Manager", "Pillar", "Admin"]


class UserCreate(BaseModel):
    """Schema for creating a new user (admin only)."""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    user_type: str = Field(..., description="Must be one of: Agent, Head, Manager, Pillar, Admin")
    parent_id: Optional[UUID] = None

    class Config:
        json_schema_extra = {
            "example": {
                "email": "john.doe@example.com",
                "username": "jdoe",
                "first_name": "John",
                "last_name": "Doe",
                "user_type": "Agent",
                "parent_id": None
            }
        }


class UserUpdate(BaseModel):
    """Schema for updating a user (admin only)."""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    user_type: Optional[str] = None
    is_active: Optional[bool] = None
    parent_id: Optional[UUID] = None


class UserBrief(BaseModel):
    """Minimal user info for assignee pickers."""
    id: UUID
    full_name: str
    email: str
    user_type: str

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    """Schema for user response."""
    id: UUID
    email: str
    username: str
    first_name: str
    last_name: str
    user_type: str
    is_active: bool
    parent_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Schema for paginated user list."""
    users: list[UserResponse]
    total: int
    page: int
    page_size: int


class UserTreeNodeResponse(BaseModel):
    """Nested user node for hierarchy tree."""
    id: UUID
    full_name: str
    email: str
    user_type: str
    parent_id: Optional[UUID]
    children: list["UserTreeNodeResponse"] = []

    class Config:
        from_attributes = True


UserTreeNodeResponse.model_rebuild()
