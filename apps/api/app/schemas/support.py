from typing import Literal

from pydantic import BaseModel, Field, model_validator

# Only this much of the conversation goes to the model.
CONTEXT_MESSAGES = 10


class SupportMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)

    @model_validator(mode="after")
    def _short_questions(self):
        if self.role == "user" and len(self.content) > 1000:
            raise ValueError("a question has at most 1000 characters")
        return self


class SupportChatRequest(BaseModel):
    """The conversation as the browser keeps it; the server stores none of it."""

    messages: list[SupportMessage] = Field(min_length=1, max_length=40)
    locale: Literal["pt-BR", "en", "es"] = "pt-BR"

    @model_validator(mode="after")
    def _ends_with_a_question(self):
        if self.messages[-1].role != "user":
            raise ValueError("the last message must be the visitor's question")
        return self

    def for_model(self) -> list[dict]:
        """The last CONTEXT_MESSAGES messages, starting with a question."""
        recent = self.messages[-CONTEXT_MESSAGES:]
        while recent[0].role != "user":
            recent = recent[1:]
        return [{"role": m.role, "content": m.content} for m in recent]
