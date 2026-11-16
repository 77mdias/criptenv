"""Second factor on destructive actions.

A user with 2FA enabled confirms the deletion of a secret with a code from the
authenticator app (or a backup code), sent in the `X-2FA-Code` header. Users
without 2FA are not asked.
"""
from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.middleware.auth import _extract_token
from app.middleware.rate_limit import RateLimitStorage
from app.models.user import User
from app.services.auth_service import AuthService

TWO_FACTOR_HEADER = "X-2FA-Code"

# Attempts per user, right or wrong, before the confirmation locks for the window.
# A correct code clears the count, so only guessing runs into it.
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60

_attempts: RateLimitStorage | None = None


def _attempt_storage() -> RateLimitStorage:
    # Same backend as the rate limiter: Redis in production, shared by all workers.
    global _attempts
    if _attempts is None:
        _attempts = RateLimitStorage(
            storage_backend=settings.RATE_LIMIT_STORAGE,
            storage_uri=settings.REDIS_URL or None,
        )
    return _attempts


def _refuse(status_code: int, code: str, message: str, headers: dict[str, str] | None = None) -> HTTPException:
    # `code` is what clients branch on; `message` is for people reading the response.
    return HTTPException(status_code=status_code, detail={"code": code, "message": message}, headers=headers)


async def _is_cli_session(request: Request, db: AsyncSession) -> bool:
    token = _extract_token(request)
    if not token:
        return False
    session, _user = await AuthService(db).resolve_session(token)
    return session is not None and session.client == "cli"


async def require_second_factor(
    request: Request,
    user: User,
    db: AsyncSession,
    *,
    exempt_cli: bool = False,
) -> None:
    """Pass when the user has no 2FA, or the request carries a valid 2FA code.

    `exempt_cli` lets CLI sessions through: the CLI has no prompt for the code yet.
    Sessions with no recorded origin are treated as dashboard sessions.
    """
    if user.two_factor_enabled is not True:
        return
    if exempt_cli and await _is_cli_session(request, db):
        return

    code = (request.headers.get(TWO_FACTOR_HEADER) or "").strip()
    if not code:
        raise _refuse(
            status.HTTP_403_FORBIDDEN,
            "TWO_FACTOR_REQUIRED",
            "Two-factor authentication is on: confirm this deletion with a code from your authenticator app.",
        )

    # Counted before it is checked, so parallel guesses cannot outrun the budget.
    # If the storage is down this raises and the deletion is refused: failing open
    # would hand unlimited guesses to whoever holds the session.
    key = f"2fa-confirm:{user.id}"
    allowed, _count = await _attempt_storage().check_and_increment(key, MAX_ATTEMPTS, WINDOW_SECONDS)
    if not allowed:
        raise _refuse(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "TWO_FACTOR_LOCKED",
            "Too many verification attempts. Try again in a few minutes.",
            headers={"Retry-After": str(WINDOW_SECONDS)},
        )

    # Re-read the user in this request's transaction: a backup code is spent by
    # writing to that row, and the caller's object may belong to another session.
    auth_service = AuthService(db)
    current = await auth_service.get_user_by_id(user.id)
    if current is None or not await auth_service.verify_two_factor_code(current, code):
        raise _refuse(status.HTTP_403_FORBIDDEN, "TWO_FACTOR_INVALID", "Invalid verification code.")

    await _attempt_storage().reset(key)
