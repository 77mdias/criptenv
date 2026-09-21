"""PKCE (RFC 7636) helpers for the CLI browser login flow.

The CLI is a public OAuth client: it cannot keep a client secret. The
authorization code that arrives on the loopback callback is therefore bound to
a per-session ``code_verifier`` that never leaves the machine. The API stores
only the S256 challenge and requires the matching verifier when the code is
exchanged for a session token, so an intercepted code is useless on its own.
"""

import base64
import hashlib
import secrets
from typing import Tuple

# 32 random bytes encode to exactly 43 base64url characters, the RFC 7636 §4.1
# minimum and maximum-entropy sweet spot for a code verifier.
CODE_VERIFIER_BYTES = 32


def _b64url_encode(data: bytes) -> str:
    """Base64url-encode without padding, as required by RFC 7636."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_code_verifier() -> str:
    """Return a fresh, high-entropy PKCE code verifier."""
    return _b64url_encode(secrets.token_bytes(CODE_VERIFIER_BYTES))


def compute_code_challenge(code_verifier: str) -> str:
    """Return the S256 challenge derived from ``code_verifier``."""
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return _b64url_encode(digest)


def generate_pkce_pair() -> Tuple[str, str]:
    """Return ``(code_verifier, code_challenge)`` for one authorization attempt."""
    verifier = generate_code_verifier()
    return verifier, compute_code_challenge(verifier)
