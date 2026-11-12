"""Support chat: one visitor question answered by Claude Haiku, with the knowledge base and docs search.

Nothing from the conversation is stored or logged; only token counts are, to follow the cost.
"""
import json
import logging
from collections.abc import AsyncIterator
from pathlib import Path

from app.support.search import search

logger = logging.getLogger(__name__)

# Haiku 5.5 matched Sonnet 5.5 on a live comparison of 8 support questions (8 of 8) at about 1/16 of the cost.
MODEL = "claude-haiku-5-5"
# Adaptive thinking counts against max_tokens: 2048 leaves room for it and a short answer.
MAX_TOKENS = 2048
MAX_SEARCH_ROUNDS = 3
LANGUAGES = {"pt-BR": "Brazilian Portuguese", "en": "English", "es": "Spanish"}

KNOWLEDGE = (Path(__file__).resolve().parent / "knowledge.md").read_text(encoding="utf-8")

INSTRUCTIONS = """You are the support assistant on the CriptEnv website (https://criptenv.77mdevseven.tech), \
talking to visitors and users who have questions about the product.

How to answer:
- Talk only about CriptEnv: the product, its use (web, CLI, API, GitHub Action, hosting integrations), plans, \
billing, security, privacy and terms. For anything else, say in one sentence that you only help with CriptEnv.
- Base every answer on the knowledge base below or on what the search_docs tool returns. Never invent features, \
commands, prices, limits, deadlines or rules. If neither source answers, say you don't know and point to the docs \
(/docs) and to support@criptenv.dev.
- Search the docs with search_docs when the question needs a detail the knowledge base doesn't have (a command \
option, an API route, a specific integration step).
- Keep answers short: a few sentences or a short list, with a code block when a command helps. Link pages with \
relative paths such as /docs/cli/commands.
- Format for a small chat window: plain sentences, "- " lists, **bold** only for a key word, `inline code` and \
fenced code blocks. No tables and no headings.
- Never ask for, repeat or store secret values. If someone pastes a password, token or key, tell them not to share \
secrets here and to rotate that one.
- You cannot see or change anyone's account, projects or secrets, and you cannot cancel, refund or create \
anything: explain how the person does it.

Knowledge base:

"""

SEARCH_TOOL = {
    "name": "search_docs",
    "description": (
        "Search the CriptEnv documentation pages. Returns up to 3 sections with their page path and text. "
        "Use short keyword queries in the conversation's language, e.g. 'docker binary image' or 'ci tokens scope'."
    ),
    "eager_input_streaming": True,
    "input_schema": {
        "type": "object",
        "properties": {"query": {"type": "string", "description": "Keywords to look for."}},
        "required": ["query"],
        "additionalProperties": False,
    },
}


def build_request(messages: list, locale: str, *, allow_search: bool) -> dict:
    """Arguments for client.beta.messages.stream: the frozen, cached prefix first, the language after it."""
    language = LANGUAGES.get(locale, LANGUAGES["pt-BR"])
    return {
        "model": MODEL,
        "max_tokens": MAX_TOKENS,
        "system": [
            {"type": "text", "text": INSTRUCTIONS + KNOWLEDGE, "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": f"Answer in {language}."},
        ],
        "tools": [SEARCH_TOOL],
        # Same tool list every round keeps the cache; the last round just may not search again.
        "tool_choice": {"type": "auto"} if allow_search else {"type": "none"},
        "output_config": {"effort": "low"},
        # Thinking blocks are bound to the exact conversation they came from. In live tests the third search
        # round was refused with "bound to a different conversation"; drop_block discards such a block instead
        # of failing the visitor's question (it only loses that round's reasoning).
        "thinking": {"type": "adaptive", "block_binding": {"prefix_mismatch_behavior": "drop_block"}},
        # No server-side refusal fallback: Haiku 5.5 does not have one. A refusal reaches the visitor as
        # "can't answer that" plus the support e-mail.
        "betas": ["thinking-binding-controls-2026-08-01"],
        "messages": messages,
    }


def _run_search(block, locale: str) -> dict:
    query = block.input.get("query") if isinstance(block.input, dict) else None
    if not isinstance(query, str) or not query.strip():
        return {"type": "tool_result", "tool_use_id": block.id, "is_error": True,
                "content": "search_docs needs a non-empty 'query' string."}
    hits = search(query, locale)
    return {"type": "tool_result", "tool_use_id": block.id,
            "content": json.dumps(hits, ensure_ascii=False) if hits else "No matching documentation section."}


def _log_usage(usage) -> None:
    logger.info(
        "support chat round: input=%s cache_read=%s cache_write=%s output=%s",
        getattr(usage, "input_tokens", 0), getattr(usage, "cache_read_input_tokens", 0),
        getattr(usage, "cache_creation_input_tokens", 0), getattr(usage, "output_tokens", 0),
    )


async def answer(client, messages: list[dict], locale: str) -> AsyncIterator[dict]:
    """Events for the browser: {"type": "text"}, then {"type": "done"} or {"type": "error", "code": ...}."""
    history = list(messages)
    wrote = False
    try:
        for round_number in range(MAX_SEARCH_ROUNDS + 1):
            request = build_request(history, locale, allow_search=round_number < MAX_SEARCH_ROUNDS)
            async with client.beta.messages.stream(**request) as stream:
                async for event in stream:
                    if event.type == "text":
                        wrote = wrote or bool(event.text)
                        yield {"type": "text", "text": event.text}
                final = await stream.get_final_message()
            _log_usage(final.usage)

            if final.stop_reason == "refusal":
                yield {"type": "error", "code": "refusal"}
                return
            tool_uses = [block for block in final.content if block.type == "tool_use"]
            if not tool_uses or final.stop_reason == "max_tokens":
                break
            history.append({"role": "assistant", "content": final.content})
            history.append({"role": "user", "content": [_run_search(block, locale) for block in tool_uses]})
    except Exception as exc:
        # The SDK's own errors, a malformed tool input or a dropped connection: the visitor gets the
        # unavailable message, the log gets the class name only (never the conversation).
        logger.warning("support chat failed: %s", type(exc).__name__)
        yield {"type": "error", "code": "unavailable"}
        return
    # Seen in live tests: after several searches the model can end with thinking only and no text.
    yield {"type": "done"} if wrote else {"type": "error", "code": "no_answer"}
