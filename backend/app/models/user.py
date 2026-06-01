from sqlalchemy import Column, String, Boolean, ForeignKey, UUID
from sqlalchemy.orm import relationship
import uuid

from app.core.database import BaseModel


class User(BaseModel):
    """User model with hierarchy support."""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    user_type = Column(String, nullable=False)  # VARCHAR, not enum - validated at application level
    is_active = Column(Boolean, default=True, nullable=False)

    # Legacy hierarchy column (unused by app logic; parent_id is canonical)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)

    # Hierarchy: self-referential parent/children tree
    parent_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    parent = relationship("User", remote_side=[id], foreign_keys=[parent_id], back_populates="children")
    children = relationship("User", foreign_keys=[parent_id], back_populates="parent")
    page_permissions = relationship("UserPagePermission", back_populates="user", cascade="all, delete-orphan")
    module_permissions = relationship("UserPermission", back_populates="user", cascade="all, delete-orphan")
    refresh_tokens = relationship("AuthRefreshToken", back_populates="user", cascade="all, delete-orphan")
    audit_logs_as_admin = relationship("UserAuditLog", foreign_keys="UserAuditLog.admin_user_id", back_populates="admin_user")
    audit_logs_as_target = relationship("UserAuditLog", foreign_keys="UserAuditLog.target_user_id", back_populates="target_user")
    task_comments = relationship("TaskComment", back_populates="user")
