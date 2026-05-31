from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class LLMMessage:
    role: str
    content: Optional[str] = None
    tool_calls: Optional[list[dict[str, Any]]] = None
    tool_call_id: Optional[str] = None
    name: Optional[str] = None


@dataclass
class LLMResponse:
    content: Optional[str] = None
    tool_calls: Optional[list[dict[str, Any]]] = None
    finish_reason: str = "stop"


class LLMProviderError(Exception):
    """Raised when an LLM provider call fails."""


class LLMProvider(ABC):
    @abstractmethod
    def chat_completion(
        self,
        messages: list[LLMMessage],
        tools: Optional[list[dict[str, Any]]] = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        raise NotImplementedError
