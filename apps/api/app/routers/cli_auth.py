"""CLI Authentication Router.

Provides browser-based OAuth login for the CLI through a localhost redirect flow,
plus a device authorization grant fallback for headless environments.
"""

import asyncio
import json
import secrets
import time
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.auth_service import AuthService
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/auth/cli", tags=["CLI Authentication"])


# ─── Shared Store with TTL ───────────────────────────────────────────────────
# Production uses Redis so Gunicorn workers share pending CLI auth state.
# Local development falls back to in-memory storage when REDIS_URL is unset.

_redis_client: object | None = None


def _get_redis_client() -> object | None:
    global _redis_client
    if not settings.REDIS_URL:
        return None
    if _redis_client is None:
        from redis.asyncio import Redis

        _redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


def _json_dumps(data: dict) -> str:
    return json.dumps(data, separators=(",", ":"))


def _json_loads(data: str | bytes | None) -> Optional[dict]:
    if data is None:
        return None
    if isinstance(data, bytes):
        data = data.decode("utf-8")
    return json.loads(data)


class _CLIAuthStore:
    """TTL store for pending CLI auth requests."""

    def __init__(
        self,
        default_ttl_seconds: int = 300,
        redis_client: object | None = None,
    ):
        self._data: dict[str, dict] = {}
        self._lock = asyncio.Lock()
        self._ttl = default_ttl_seconds
        self._redis = redis_client if redis_client is not None else _get_redis_client()

    def _state_key(self, state: str) -> str:
        return f"cli_auth:state:{state}"

    def _code_key(self, auth_code: str) -> str:
        return f"cli_auth:code:{auth_code}"

    async def create(self, state: str, callback_url: str) -> str:
        """Create a new pending auth request. Returns auth_code."""
        auth_code = secrets.token_urlsafe(32)
        state_entry = {
            "auth_code": auth_code,
            "callback_url": callback_url,
            "created_at": time.time(),
            "user_id": None,
            "authorized": False,
        }
        code_entry = {
            "state": state,
            "created_at": time.time(),
            "user_id": None,
            "authorized": False,
        }
        if self._redis is not None:
            await self._redis.setex(
                self._state_key(state), self._ttl, _json_dumps(state_entry)
            )
            await self._redis.setex(
                self._code_key(auth_code), self._ttl, _json_dumps(code_entry)
            )
            return auth_code

        async with self._lock:
            self._cleanup()
            self._data[state] = state_entry
            # Also index by auth_code for token exchange
            self._data[auth_code] = code_entry
        return auth_code

    async def authorize(self, state: str, user_id: str) -> Optional[str]:
        """Mark a state as authorized by a user. Returns auth_code."""
        if self._redis is not None:
            entry = _json_loads(await self._redis.get(self._state_key(state)))
            if not entry:
                return None
            auth_code = entry["auth_code"]
            entry["user_id"] = user_id
            entry["authorized"] = True
            code_entry = _json_loads(await self._redis.get(self._code_key(auth_code))) or {
                "state": state,
                "created_at": entry["created_at"],
            }
            code_entry["user_id"] = user_id
            code_entry["authorized"] = True
            await self._redis.setex(
                self._state_key(state), self._ttl, _json_dumps(entry)
            )
            await self._redis.setex(
                self._code_key(auth_code), self._ttl, _json_dumps(code_entry)
            )
            return auth_code

        async with self._lock:
            self._cleanup()
            entry = self._data.get(state)
            if not entry or time.time() - entry["created_at"] > self._ttl:
                return None
            auth_code = entry["auth_code"]
            entry["user_id"] = user_id
            entry["authorized"] = True
            # Update auth_code entry too
            if auth_code in self._data:
                self._data[auth_code]["user_id"] = user_id
                self._data[auth_code]["authorized"] = True
            return auth_code

    async def get_by_code(self, auth_code: str) -> Optional[dict]:
        """Get auth entry by auth_code. Returns None if expired/invalid."""
        if self._redis is not None:
            return _json_loads(await self._redis.get(self._code_key(auth_code)))

        async with self._lock:
            self._cleanup()
            entry = self._data.get(auth_code)
            if not entry or time.time() - entry["created_at"] > self._ttl:
                return None
            return entry.copy()

    async def delete(self, key: str):
        """Remove an entry by state or auth_code."""
        if self._redis is not None:
            entry = _json_loads(await self._redis.get(self._code_key(key)))
            if entry and "state" in entry:
                await self._redis.delete(
                    self._code_key(key), self._state_key(entry["state"])
                )
                return
            entry = _json_loads(await self._redis.get(self._state_key(key)))
            if entry and "auth_code" in entry:
                await self._redis.delete(
                    self._state_key(key), self._code_key(entry["auth_code"])
                )
                return
            await self._redis.delete(self._code_key(key), self._state_key(key))
            return

        async with self._lock:
            entry = self._data.pop(key, None)
            if entry:
                # Also clean up the cross-reference
                if "auth_code" in entry and entry["auth_code"] in self._data:
                    self._data.pop(entry["auth_code"], None)
                elif "state" in entry and entry["state"] in self._data:
                    self._data.pop(entry["state"], None)

    def _cleanup(self):
        now = time.time()
        expired = [k for k, v in self._data.items() if now - v["created_at"] > self._ttl]
        for k in expired:
            self._data.pop(k, None)


_cli_auth_store = _CLIAuthStore(default_ttl_seconds=300)


# ─── Device Flow Store ───────────────────────────────────────────────────────

class _DeviceFlowStore:
    """TTL store for device authorization grant."""

    def __init__(
        self,
        default_ttl_seconds: int = 600,
        redis_client: object | None = None,
    ):
        self._data: dict[str, dict] = {}
        self._lock = asyncio.Lock()
        self._ttl = default_ttl_seconds
        self._redis = redis_client if redis_client is not None else _get_redis_client()

    def _device_key(self, device_code: str) -> str:
        return f"cli_auth:device:{device_code}"

    async def create(self) -> tuple[str, str, str]:
        """Create device flow request. Returns (device_code, user_code, verification_uri)."""
        device_code = secrets.token_urlsafe(32)
        user_code = "-".join([secrets.token_hex(2).upper() for _ in range(3)])
        verification_uri = f"{settings.FRONTEND_URL.rstrip('/')}/cli-auth?device_code={device_code}"
        entry = {
            "user_code": user_code,
            "created_at": time.time(),
            "user_id": None,
            "authorized": False,
            "interval": 5,
        }

        if self._redis is not None:
            await self._redis.setex(
                self._device_key(device_code), self._ttl, _json_dumps(entry)
            )
            return device_code, user_code, verification_uri

        async with self._lock:
            self._cleanup()
            self._data[device_code] = entry
        return device_code, user_code, verification_uri

    async def authorize(self, device_code: str, user_id: str) -> bool:
        """Mark a device code as authorized."""
        if self._redis is not None:
            entry = _json_loads(await self._redis.get(self._device_key(device_code)))
            if not entry:
                return False
            entry["user_id"] = user_id
            entry["authorized"] = True
            await self._redis.setex(
                self._device_key(device_code), self._ttl, _json_dumps(entry)
            )
            return True

        async with self._lock:
            self._cleanup()
            entry = self._data.get(device_code)
            if not entry or time.time() - entry["created_at"] > self._ttl:
                return False
            entry["user_id"] = user_id
            entry["authorized"] = True
            return True

    async def poll(self, device_code: str) -> Optional[dict]:
        """Poll for device authorization. Returns entry or None."""
        if self._redis is not None:
            return _json_loads(await self._redis.get(self._device_key(device_code)))

        async with self._lock:
            self._cleanup()
            entry = self._data.get(device_code)
            if not entry:
                return None
            if time.time() - entry["created_at"] > self._ttl:
                return None
            return entry.copy()

    def _cleanup(self):
        now = time.time()
        expired = [k for k, v in self._data.items() if now - v["created_at"] > self._ttl]
        for k in expired:
            self._data.pop(k, None)


_device_flow_store = _DeviceFlowStore(default_ttl_seconds=600)


# ─── Schemas ─────────────────────────────────────────────────────────────────

class CLIInitiateRequest(BaseModel):
    callback_url: str = Field(..., description="Localhost callback URL where CLI is listening")


class CLIInitiateResponse(BaseModel):
    auth_url: str
    state: str
    expires_in: int = 300


class CLIAuthorizeRequest(BaseModel):
    state: str


class CLIAuthorizeResponse(BaseModel):
    auth_code: str
    callback_url: str


class CLITokenRequest(BaseModel):
    auth_code: str


class CLITokenResponse(BaseModel):
    token: str
    user: dict


class DeviceCodeRequest(BaseModel):
    pass


class DeviceCodeResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    expires_in: int = 600
    interval: int = 5


class DevicePollRequest(BaseModel):
    device_code: str


class DevicePollResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[dict] = None
    status: str  # "pending", "authorized", "expired"


# ─── Helper ──────────────────────────────────────────────────────────────────

def _user_to_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": str(user.email),
        "name": user.name,
        "kdf_salt": user.kdf_salt,
        "avatar_url": user.avatar_url,
        "email_verified": user.email_verified,
        "two_factor_enabled": user.two_factor_enabled,
    }


# ─── Browser Redirect Flow ───────────────────────────────────────────────────

@router.post("/initiate", response_model=CLIInitiateResponse)
async def cli_initiate(
    request: CLIInitiateRequest,
):
    """Initiate a browser-based CLI login.

    The CLI calls this to get a state and auth URL. It then opens the browser
    to the auth URL and starts a localhost server to receive the callback.
    """
    state = secrets.token_urlsafe(32)
    auth_code = await _cli_auth_store.create(state, request.callback_url)

    # Build the web URL where the user will authenticate
    auth_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/cli-auth?"
        f"state={state}&callback={request.callback_url}"
    )

    return CLIInitiateResponse(
        auth_url=auth_url,
        state=state,
        expires_in=300,
    )


@router.post("/authorize", response_model=CLIAuthorizeResponse)
async def cli_authorize(
    payload: CLIAuthorizeRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Authorize a pending CLI login request.

    The web frontend calls this after the user has authenticated.
    It links the user to the pending state and returns an auth_code
    that the web will send back to the CLI via localhost redirect.
    """
    auth_code = await _cli_auth_store.authorize(payload.state, str(current_user.id))
    if not auth_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired state. Please try again."
        )

    return CLIAuthorizeResponse(
        auth_code=auth_code,
        callback_url="",  # Web knows the callback from query params
    )


@router.post("/token", response_model=CLITokenResponse)
async def cli_token(
    payload: CLITokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Exchange an auth_code for a session token.

    The CLI calls this after receiving the auth_code via localhost callback.
    """
    entry = await _cli_auth_store.get_by_code(payload.auth_code)
    if not entry or not entry.get("authorized"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired auth code."
        )

    user_id = entry.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization incomplete."
        )

    # Clean up the used code
    await _cli_auth_store.delete(payload.auth_code)

    # Create a session for the CLI
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    session = await auth_service.create_session(
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent", "CriptEnv CLI"),
    )

    return CLITokenResponse(
        token=session.token,
        user=_user_to_dict(user),
    )


# ─── Device Authorization Grant (RFC 8628) ───────────────────────────────────

@router.post("/device/code", response_model=DeviceCodeResponse)
async def device_code(
    request: Request,
):
    """Start a device authorization flow.

    Returns a user_code and verification_uri that the CLI displays.
    The user opens the URI in a browser and authenticates.
    The CLI polls /device/poll until authorized.
    """
    device_code, user_code, verification_uri = await _device_flow_store.create()

    return DeviceCodeResponse(
        device_code=device_code,
        user_code=user_code,
        verification_uri=verification_uri,
        expires_in=600,
        interval=5,
    )


class DeviceAuthorizeRequest(BaseModel):
    device_code: str


@router.post("/device/authorize")
async def device_authorize(
    payload: DeviceAuthorizeRequest,
    current_user: User = Depends(get_current_user),
):
    """Authorize a device flow request.

    The web frontend calls this after the user authenticates on the device flow page.
    """
    success = await _device_flow_store.authorize(payload.device_code, str(current_user.id))
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired device code."
        )
    return {"status": "authorized"}


@router.post("/device/poll", response_model=DevicePollResponse)
async def device_poll(
    payload: DevicePollRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Poll for device authorization status.

    The CLI calls this every `interval` seconds until the user authorizes
    or the device_code expires.
    """
    entry = await _device_flow_store.poll(payload.device_code)
    if not entry:
        return DevicePollResponse(status="expired")

    if not entry.get("authorized"):
        return DevicePollResponse(status="pending")

    # Authorized — create session and return token
    user_id = entry.get("user_id")
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)
    if not user:
        return DevicePollResponse(status="expired")

    session = await auth_service.create_session(
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent", "CriptEnv CLI"),
    )

    return DevicePollResponse(
        access_token=session.token,
        token_type="bearer",
        user=_user_to_dict(user),
        status="authorized",
    )
