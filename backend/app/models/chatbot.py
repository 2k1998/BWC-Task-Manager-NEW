from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from app.core.database import Base, BaseModel


class ChatbotConversation(BaseModel):
    __tablename__ = "chatbot_conversations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=True)

    messages = relationship(
        "ChatbotMessage",
        back_populates="conversation",
        order_by="ChatbotMessage.created_at",
    )


class ChatbotMessage(Base):
    __tablename__ = "chatbot_messages"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("chatbot_conversations.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=True)
    tool_calls = Column(JSONB, nullable=True)
    tool_call_id = Column(String(255), nullable=True)
    tool_name = Column(String(100), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        server_default=sa.text("NOW()"),
        nullable=False,
        index=True,
    )

    conversation = relationship("ChatbotConversation", back_populates="messages")


class ChatbotKnowledge(BaseModel):
    __tablename__ = "chatbot_knowledge"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )
    topic = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(ARRAY(String), nullable=False, server_default="{}")
    language = Column(String(5), nullable=False, server_default="en", index=True)


class UserOnboardingProgress(BaseModel):
    __tablename__ = "user_onboarding_progress"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    tour_id = Column(String(100), nullable=False)
    step_index = Column(Integer, nullable=False, server_default="0")
    completed = Column(Boolean, nullable=False, server_default="false")
    skipped = Column(Boolean, nullable=False, server_default="false")
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "tour_id", name="uq_user_tour"),
    )
