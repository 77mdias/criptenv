"""Data models for local vault."""

from dataclasses import dataclass
import time


@dataclass
class Session:
    """Encrypted session token stored locally."""

    id: str
    user_id: str
    email: str
    token_encrypted: bytes
    created_at: int
    expires_at: int

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at


@dataclass
class Environment:
    """Environment metadata with encrypted key."""

    id: str
    project_id: str
    name: str
    env_key_encrypted: bytes
    created_at: int
    updated_at: int


@dataclass
class Secret:
    """Encrypted secret stored locally."""

    id: str
    environment_id: str
    key_id: str
    iv: bytes
    ciphertext: bytes
    auth_tag: bytes
    version: int
    checksum: str
    created_at: int
    updated_at: int
