from __future__ import annotations

import logging

from sqlalchemy import case, desc, or_
from sqlalchemy.orm import Session

from app.models.chatbot import ChatbotKnowledge

logger = logging.getLogger(__name__)


def search_knowledge_base(
    query: str,
    language: str,
    db: Session,
    limit: int = 3,
) -> list[dict]:
    cleaned = query.strip()
    if not cleaned:
        return []

    pattern = f"%{cleaned}%"
    topic_match = case(
        (ChatbotKnowledge.topic.ilike(pattern), 1),
        else_=0,
    )

    try:
        rows = (
            db.query(ChatbotKnowledge)
            .filter(
                ChatbotKnowledge.language == language,
                or_(
                    ChatbotKnowledge.topic.ilike(pattern),
                    ChatbotKnowledge.content.ilike(pattern),
                ),
            )
            .order_by(desc(topic_match), desc(ChatbotKnowledge.updated_at))
            .limit(limit)
            .all()
        )
    except Exception:
        logger.exception("KB search failed")
        return []

    return [
        {"topic": row.topic, "content": row.content, "tags": list(row.tags or [])}
        for row in rows
    ]
