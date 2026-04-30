"""Crypto utility functions."""

import base64
import hashlib
import os


def to_base64(data: bytes) -> str:
    """Encode bytes to base64 string."""
    return base64.b64encode(data).decode("ascii")


def from_base64(data: str) -> bytes:
    """Decode base64 string to bytes."""
    return base64.b64decode(data)


def compute_checksum(data: bytes) -> str:
    """Compute SHA-256 hex digest of data."""
    return hashlib.sha256(data).hexdigest()


def generate_id(prefix: str = "sec") -> str:
    """Generate a unique ID with prefix."""
    random_part = os.urandom(8).hex()
    return f"{prefix}_{random_part}"
