"""Auth API endpoint wrappers."""

from typing import Optional

from criptenv.api.client import CriptEnvClient


async def signin(client: CriptEnvClient, email: str, password: str) -> dict:
    """
    Sign in and return auth response with token.

    Returns:
        dict with keys: user, session, token
    """
    return await client.signin(email, password)


async def signup(
    client: CriptEnvClient, email: str, password: str, name: str
) -> dict:
    """Sign up a new account."""
    return await client.signup(email, password, name)


async def signout(client: CriptEnvClient) -> dict:
    """Sign out current session."""
    return await client.signout()


async def validate_session(client: CriptEnvClient) -> Optional[dict]:
    """
    Validate current session token.

    Returns:
        User dict if valid, None if invalid/expired.
    """
    try:
        return await client.get_session()
    except Exception:
        return None
