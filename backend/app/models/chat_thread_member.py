from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ChatThreadMember(Base):
    __tablename__ = "chat_thread_members"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )
    thread_id = Column(
        UUID(as_uuid=True),
        sa.ForeignKey("chat_threads.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    role = Column(
        String,
        server_default=sa.text("'member'"),
        nullable=False,
    )
    joined_at = Column(
        DateTime(timezone=True),
        server_default=sa.text("NOW()"),
        nullable=False,
    )

    __table_args__ = (
        sa.UniqueConstraint("thread_id", "user_id", name="uq_chat_thread_members_thread_user"),
        sa.CheckConstraint("role IN ('owner', 'member')", name="ck_chat_thread_members_role"),
    )
