from __future__ import annotations

import logging
from typing import Any, Optional

import groq
from groq import Groq

from app.core.config import settings
from app.utils.llm_provider import LLMMessage, LLMProvider, LLMProviderError, LLMResponse

logger = logging.getLogger(__name__)

_provider_instance: Optional[LLMProvider] = None


def _message_to_dict(message: LLMMessage) -> dict[str, Any]:
    payload: dict[str, Any] = {"role": message.role}
    if message.content is not None:
        payload["content"] = message.content
    if message.tool_calls is not None:
        payload["tool_calls"] = message.tool_calls
    if message.tool_call_id is not None:
        payload["tool_call_id"] = message.tool_call_id
    if message.name is not None:
        payload["name"] = message.name
    return payload


def _serialize_tool_calls(tool_calls: Any) -> list[dict[str, Any]]:
    serialized: list[dict[str, Any]] = []
    for tc in tool_calls or []:
        serialized.append(
            {
                "id": tc.id,
                "type": tc.type,
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
        )
    return serialized


class GroqProvider(LLMProvider):
    def __init__(self) -> None:
        if not settings.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set in environment")
        self.client = Groq(
            api_key=settings.GROQ_API_KEY,
            timeout=settings.CHATBOT_REQUEST_TIMEOUT_SECONDS,
        )
        self.model = settings.GROQ_MODEL

    def chat_completion(
        self,
        messages: list[LLMMessage],
        tools: Optional[list[dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        api_messages = [_message_to_dict(m) for m in messages]
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": api_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        try:
            response = self.client.chat.completions.create(**kwargs)
        except groq.RateLimitError as err:
            logger.warning("Groq rate limit: %s", err)
            raise LLMProviderError("Rate limit reached. Please try again in a moment.") from err
        except groq.APITimeoutError as err:
            logger.warning("Groq timeout: %s", err)
            raise LLMProviderError(
                "The assistant took too long to respond. Please try again."
            ) from err
        except groq.APIConnectionError as err:
            logger.error("Groq connection error: %s", err)
            raise LLMProviderError("Could not reach the assistant service.") from err
        except groq.APIStatusError as err:
            logger.error("Groq API status error: %s", err)
            is_tool_fail = "tool_use_failed" in str(err) or (
                getattr(err, "body", {}) or {}
            ).get("error", {}).get("code") == "tool_use_failed"
            if is_tool_fail and tools:
                logger.warning(
                    "tool_use_failed from model — retrying without tools as fallback"
                )
                fallback_kwargs: dict[str, Any] = {
                    "model": self.model,
                    "messages": api_messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                try:
                    fb = self.client.chat.completions.create(**fallback_kwargs)
                    fb_choice = fb.choices[0]
                    fb_msg = fb_choice.message
                    return LLMResponse(
                        content=fb_msg.content,
                        tool_calls=[],
                        finish_reason=fb_choice.finish_reason or "stop",
                    )
                except Exception as fallback_err:
                    logger.error("Fallback (no-tools) also failed: %s", fallback_err)
                    raise LLMProviderError(
                        "The assistant service returned an error."
                    ) from fallback_err
            raise LLMProviderError("The assistant service returned an error.") from err
        except Exception as err:
            logger.exception("Unexpected Groq error")
            raise LLMProviderError("An unexpected error occurred.") from err

        choice = response.choices[0]
        message = choice.message
        return LLMResponse(
            content=message.content,
            tool_calls=_serialize_tool_calls(message.tool_calls),
            finish_reason=choice.finish_reason or "stop",
        )


def get_llm_provider() -> LLMProvider:
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = GroqProvider()
    return _provider_instance
