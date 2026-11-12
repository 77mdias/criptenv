"""Public support chat (no login). Limits per IP and per day live in the rate limit middleware."""
import json
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.config import settings
from app.schemas.support import SupportChatRequest
from app.support.chat import answer

router = APIRouter(prefix="/api/v1/support", tags=["Support"])


@lru_cache(maxsize=1)
def _client(api_key: str):
    from anthropic import AsyncAnthropic

    return AsyncAnthropic(api_key=api_key)


def get_support_client():
    """The Claude API client, or None when no key is configured (the chat is off)."""
    return _client(settings.ANTHROPIC_API_KEY) if settings.ANTHROPIC_API_KEY else None


@router.get("/status")
async def support_status():
    return {"enabled": bool(settings.ANTHROPIC_API_KEY)}


@router.post("/chat")
async def support_chat(payload: SupportChatRequest, client=Depends(get_support_client)):
    if client is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Support chat is off")

    async def events():
        async for event in answer(client, payload.for_model(), payload.locale):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        # Proxies (Cloudflare, nginx) must pass the stream through instead of buffering it.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
