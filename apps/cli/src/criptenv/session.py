"""Session token management with encryption."""

import os
import secrets
import time
import uuid
from typing import Optional

from criptenv.crypto import encrypt, decrypt
from criptenv.vault.models import Session
from criptenv.vault import queries
from criptenv.api.client import CriptEnvClient
from criptenv.config import AUTH_KEY_FILE

import aiosqlite

AUTH_KEY_LENGTH = 32


def get_or_create_auth_key() -> bytes:
    """Return the local key used to encrypt CLI auth sessions.

    This key protects API session tokens. It is intentionally separate from the
    user's secrets vault password so API-only commands do not unlock secrets.
    """
    if AUTH_KEY_FILE.exists():
        key = AUTH_KEY_FILE.read_bytes()
        if len(key) != AUTH_KEY_LENGTH:
            raise ValueError(f"Invalid CLI auth key at {AUTH_KEY_FILE}")
        return key

    AUTH_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    key = secrets.token_bytes(AUTH_KEY_LENGTH)
    fd = os.open(str(AUTH_KEY_FILE), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(key)
    try:
        os.chmod(AUTH_KEY_FILE, 0o600)
    except OSError:
        pass
    return key


class SessionManager:
    """Manages encrypted session tokens in the local CLI database."""

    def __init__(self, storage_key: bytes, db: aiosqlite.Connection):
        self.storage_key = storage_key
        self.db = db
        self.client = CriptEnvClient()
        self._current_session: Optional[Session] = None

    def _encrypt_token(self, token: str) -> bytes:
        """Encrypt token with the local session key. Returns iv + ciphertext + auth_tag."""
        ciphertext, iv, auth_tag, _ = encrypt(token.encode("utf-8"), self.storage_key)
        return iv + ciphertext + auth_tag

    def _decrypt_token(self, encrypted: bytes) -> str:
        """Decrypt token from iv + ciphertext + auth_tag."""
        iv = encrypted[:12]
        ciphertext = encrypted[12:-16]
        auth_tag = encrypted[-16:]
        plaintext = decrypt(ciphertext, iv, auth_tag, self.storage_key)
        return plaintext.decode("utf-8")

    async def login(self, email: str, password: str) -> dict:
        """
        Login via API and store encrypted session locally.

        Returns:
            User info dict from API response
        """
        # Call API
        response = await self.client.signin(email, password)
        token = response["token"]
        user = response["user"]

        return await self._store_session(token, user)

    async def login_with_token(self, token: str, user: dict) -> dict:
        """
        Store an externally-obtained token (e.g., from OAuth or device flow).

        Returns:
            User info dict
        """
        return await self._store_session(token, user)

    async def _store_session(self, token: str, user: dict) -> dict:
        """Encrypt and store a session token in the local vault."""
        # Encrypt token with master key
        token_encrypted = self._encrypt_token(token)

        # Store in local vault
        session = Session(
            id=str(uuid.uuid4()),
            user_id=user["id"],
            email=user.get("email", ""),
            token_encrypted=token_encrypted,
            created_at=int(time.time()),
            expires_at=int(time.time()) + 30 * 24 * 60 * 60,  # 30 days
        )
        await queries.save_session(self.db, session)

        # Set token on client for subsequent requests
        self.client.set_token(token)
        self._current_session = session

        return user

    async def logout(self):
        """Logout and clear local session."""
        session = await self.get_active_session()
        if session:
            try:
                self.client.set_token(self._decrypt_token(session.token_encrypted))
                await self.client.signout()
            except Exception:
                pass  # Best effort

            await queries.delete_all_sessions(self.db)

        self.client.clear_token()
        self._current_session = None

    async def get_active_session(self) -> Optional[Session]:
        """Get the active (non-expired) session from local vault."""
        if self._current_session and not self._current_session.is_expired:
            return self._current_session

        session = await queries.get_active_session(self.db)
        self._current_session = session
        return session

    async def get_authenticated_client(self) -> Optional[CriptEnvClient]:
        """
        Get an API client with a valid session token.

        Returns:
            Authenticated client, or None if no valid session.
        """
        session = await self.get_active_session()
        if not session:
            return None

        token = self._decrypt_token(session.token_encrypted)
        self.client.set_token(token)
        return self.client

    async def validate(self) -> Optional[dict]:
        """
        Validate current session against the API.

        Returns:
            User info if valid, None if invalid.
        """
        client = await self.get_authenticated_client()
        if not client:
            return None

        try:
            return await client.get_session()
        except Exception:
            return None
