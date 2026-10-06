"""Request correlation middleware.

Assigns (or honours an incoming) ``X-Request-ID``, binds it to the logging
contextvar so every log line within the request carries it, and echoes it
back on the response for cross-system tracing.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.observability import new_request_id, request_id_var

REQUEST_ID_HEADER = "X-Request-ID"
MAX_INCOMING_LENGTH = 128


def _sanitize(value: str) -> str:
    """Keep incoming ids short and printable so they cannot inject log noise."""
    cleaned = "".join(ch for ch in value if ch.isprintable() and ch not in "\r\n\t")
    return cleaned[:MAX_INCOMING_LENGTH]


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = _sanitize(incoming) if incoming else new_request_id()

        token = request_id_var.set(request_id)
        request.state.request_id = request_id
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)

        response.headers[REQUEST_ID_HEADER] = request_id
        return response
