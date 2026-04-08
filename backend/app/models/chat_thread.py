from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=sa.text("gen_random_uuid()"),
        nullable=False,
    )

    user_one_id = Column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    user_two_id = Column(
        UUID(as_uuid=True),
        sa.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=sa.text("NOW()"),
        nullable=False,
    )

    # Unique pairing is enforced in DB. We also enforce ordering to prevent duplicates.
    __table_args__ = (
        sa.UniqueConstraint("user_one_id", "user_two_id", name="uq_chat_threads_user_pair"),
        sa.CheckConstraint("user_one_id < user_two_id", name="ck_chat_threads_user_order"),
    )

