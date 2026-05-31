from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chatbot import ChatbotConversation, ChatbotMessage
from app.models.user import User
from app.utils.chatbot_system_prompt import build_system_prompt
from app.utils.chatbot_tools import TOOL_DEFINITIONS, execute_tool
from app.utils.groq_provider import get_llm_provider
from app.utils.llm_provider import LLMMessage, LLMProviderError

logger = logging.getLogger(__name__)


def create_conversation(user: User, db: Session) -> ChatbotConversation:
    conv = ChatbotConversation(user_id=user.id, title=None)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def list_conversations(user: User, db: Session) -> list[ChatbotConversation]:
    return (
        db.query(ChatbotConversation)
        .filter(ChatbotConversation.user_id == user.id)
        .order_by(ChatbotConversation.updated_at.desc())
        .all()
    )


def _get_conversation_or_404(
    conversation_id: UUID,
    user: User,
    db: Session,
) -> ChatbotConversation:
    conv = (
        db.query(ChatbotConversation)
        .filter(
            ChatbotConversation.id == conversation_id,
            ChatbotConversation.user_id == user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


def list_messages(
    conversation_id: UUID,
    user: User,
    db: Session,
) -> list[ChatbotMessage]:
    conv = _get_conversation_or_404(conversation_id, user, db)
    return (
        db.query(ChatbotMessage)
        .filter(
            ChatbotMessage.conversation_id == conv.id,
            ChatbotMessage.role != "system",
        )
        .order_by(ChatbotMessage.created_at.asc())
        .all()
    )


def _build_llm_messages(user: User, conv_id: UUID, db: Session) -> list[LLMMessage]:
    rows = (
        db.query(ChatbotMessage)
        .filter(
            ChatbotMessage.conversation_id == conv_id,
            ChatbotMessage.role != "system",
        )
        .order_by(ChatbotMessage.created_at.desc())
        .limit(settings.CHATBOT_MAX_HISTORY_MESSAGES)
        .all()
    )
    rows.reverse()

    messages: list[LLMMessage] = [
        LLMMessage(role="system", content=build_system_prompt(user)),
    ]
    for row in rows:
        messages.append(
            LLMMessage(
                role=row.role,
                content=row.content,
                tool_calls=row.tool_calls,
                tool_call_id=row.tool_call_id,
                name=row.tool_name,
            )
        )
    return messages


def send_message(
    conversation_id: UUID,
    user_content: str,
    user: User,
    db: Session,
) -> ChatbotMessage:
    conv = _get_conversation_or_404(conversation_id, user, db)

    user_msg = ChatbotMessage(
        conversation_id=conv.id,
        role="user",
        content=user_content,
    )
    if not conv.title:
        conv.title = user_content[:60]
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    try:
        llm = get_llm_provider()

        for iteration in range(settings.CHATBOT_MAX_TOOL_ITERATIONS):
            messages = _build_llm_messages(user, conv.id, db)
            history_count = max(len(messages) - 1, 0)
            logger.info(
                "Chatbot LLM call: conv=%s iter=%s history_msgs=%s",
                conv.id,
                iteration + 1,
                history_count,
            )

            response = llm.chat_completion(messages=messages, tools=TOOL_DEFINITIONS)

            if response.tool_calls:
                assistant_row = ChatbotMessage(
                    conversation_id=conv.id,
                    role="assistant",
                    content=response.content,
                    tool_calls=response.tool_calls,
                )
                db.add(assistant_row)
                db.commit()

                for tc in response.tool_calls:
                    tool_name = tc["function"]["name"]
                    arguments_json = tc["function"]["arguments"]
                    tc_id = tc["id"]
                    result_text = execute_tool(tool_name, arguments_json, user, db)
                    tool_row = ChatbotMessage(
                        conversation_id=conv.id,
                        role="tool",
                        content=result_text,
                        tool_call_id=tc_id,
                        tool_name=tool_name,
                    )
                    db.add(tool_row)
                    db.commit()
                continue

            final_content = response.content or (
                "I couldn't generate a response. Please try again."
            )
            assistant_msg = ChatbotMessage(
                conversation_id=conv.id,
                role="assistant",
                content=final_content,
            )
            conv.updated_at = datetime.now(timezone.utc)
            db.add(assistant_msg)
            db.commit()
            db.refresh(assistant_msg)
            return assistant_msg

        logger.warning("Tool loop exhausted for conv=%s", conv.id)
        fallback_msg = ChatbotMessage(
            conversation_id=conv.id,
            role="assistant",
            content="I had trouble processing that. Could you rephrase your question?",
        )
        conv.updated_at = datetime.now(timezone.utc)
        db.add(fallback_msg)
        db.commit()
        db.refresh(fallback_msg)
        return fallback_msg

    except LLMProviderError as err:
        logger.error("LLM provider error for conv=%s: %s", conv.id, err)
        error_msg = ChatbotMessage(
            conversation_id=conv.id,
            role="assistant",
            content=f"⚠️ {err}",
        )
        conv.updated_at = datetime.now(timezone.utc)
        db.add(error_msg)
        db.commit()
        db.refresh(error_msg)
        return error_msg
