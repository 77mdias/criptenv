# M1.4: Auth Integration

**Milestone**: M1.4
**Duration**: Week 4
**Goal**: Integrate with existing `/api/auth/*` endpoints
**Status**: ✅ COMPLETE (2026-04-30)

---

## Overview

The CLI authenticates against the existing FastAPI backend using session tokens. The session token is stored encrypted in the local vault, never in plaintext.

---

## Backend API Endpoints

| Endpoint            | Method | Description                                      |
| ------------------- | ------ | ------------------------------------------------ |
| `/api/auth/signin`  | POST   | Login with email/password, returns session token |
| `/api/auth/signout` | POST   | Logout current session                           |
| `/api/auth/session` | GET    | Validate current session, returns user info      |
| `/api/auth/signup`  | POST   | Create new account                               |

---

## API Client: api/client.py

```python
"""HTTP client for CriptEnv API"""

import httpx
from typing import Optional

from criptenv.config import API_BASE_URL


class CriptEnvClient:
    """Async HTTP client for CriptEnv API"""

    def __init__(self, base_url: str = API_BASE_URL, session_token: Optional[str] = None):
        self.base_url = base_url
        self.session_token = session_token

    def set_token(self, token: str):
        """Set session token for requests"""
        self.session_token = token

    def clear_token(self):
        """Clear session token"""
        self.session_token = None

    @property
    def headers(self) -> dict:
        """Build headers with auth"""
        headers = {"Content-Type": "application/json"}
        if self.session_token:
            headers["Authorization"] = f"Bearer {self.session_token}"
        return headers

    async def _request(self, method: str, path: str, **kwargs) -> httpx.Response:
        """Make HTTP request"""
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method,
                url,
                headers=self.headers,
                **kwargs
            )
            return response

    # Auth endpoints
    async def signin(self, email: str, password: str) -> dict:
        """POST /api/auth/signin"""
        response = await self._request(
            "POST",
            "/api/auth/signin",
            json={"email": email, "password": password}
        )
        return response

    async def signup(self, email: str, password: str) -> dict:
        """POST /api/auth/signup"""
        response = await self._request(
            "POST",
            "/api/auth/signup",
            json={"email": email, "password": password}
        )
        return response

    async def signout(self) -> dict:
        """POST /api/auth/signout"""
        response = await self._request("POST", "/api/auth/signout")
        return response

    async def get_session(self) -> dict:
        """GET /api/auth/session"""
        response = await self._request("GET", "/api/auth/session")
        return response

    # Vault endpoints
    async def push_vault(self, project_id: str, env_id: str, blobs: list) -> dict:
        """POST /api/v1/projects/{id}/environments/{eid}/vault/push"""
        response = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/environments/{env_id}/vault/push",
            json={"blobs": blobs}
        )
        return response

    async def pull_vault(self, project_id: str, env_id: str) -> dict:
        """GET /api/v1/projects/{id}/environments/{eid}/vault/pull"""
        response = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/environments/{env_id}/vault/pull"
        )
        return response

    async def get_vault_version(self, project_id: str, env_id: str) -> dict:
        """GET /api/v1/projects/{id}/environments/{eid}/vault/version"""
        response = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/environments/{env_id}/vault/version"
        )
        return response

    # Project endpoints
    async def list_projects(self) -> dict:
        """GET /api/v1/projects"""
        response = await self._request("GET", "/api/v1/projects")
        return response

    async def create_project(self, name: str) -> dict:
        """POST /api/v1/projects"""
        response = await self._request(
            "POST",
            "/api/v1/projects",
            json={"name": name}
        )
        return response

    # Environment endpoints
    async def list_environments(self, project_id: str) -> dict:
        """GET /api/v1/projects/{id}/environments"""
        response = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/environments"
        )
        return response

    async def create_environment(self, project_id: str, name: str) -> dict:
        """POST /api/v1/projects/{id}/environments"""
        response = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/environments",
            json={"name": name}
        )
        return response
```

---

## Session Management: session.py

```python
"""Session token management with encryption"""

import time
import os
from typing import Optional

from criptenv.crypto import encrypt, decrypt, derive_master_key, generate_salt
from criptenv.vault import queries, Session
from criptenv.api.client import CriptEnvClient


class SessionManager:
    """Manages encrypted session tokens"""

    def __init__(self, master_key: bytes):
        self.master_key = master_key
        self.client = CriptEnvClient()
        self._current_session: Optional[Session] = None

    def _encrypt_token(self, token: str) -> bytes:
        """Encrypt token with master key"""
        ciphertext, iv, auth_tag, checksum = encrypt(
            token.encode(),
            self.master_key
        )
        return iv + ciphertext + auth_tag

    def _decrypt_token(self, encrypted: bytes) -> str:
        """Decrypt token with master key"""
        iv = encrypted[:12]
        ciphertext = encrypted[12:-16]
        auth_tag = encrypted[-16:]
        plaintext = decrypt(ciphertext, iv, auth_tag, self.master_key)
        return plaintext.decode()

    async def login(self, email: str, password: str) -> Session:
        """Login and store encrypted session"""
        response = await self.client.signin(email, password)

        if response.status_code != 200:
            raise ValueError(f"Login failed: {response.json().get('detail', 'Unknown error')}")

        data = response.json()
        token = data["session_token"]
        user_id = data["user_id"]

        encrypted_token = self._encrypt_token(token)
        session = Session(
            id=f"sess_{os.urandom(16).hex()}",
            user_id=user_id,
            email=email,
            token_encrypted=encrypted_token,
            created_at=int(time.time()),
            expires_at=int(time.time()) + 86400 * 7
        )
        await queries.save_session(session)

        self._current_session = session
        self.client.set_token(token)
        return session

    async def restore_session(self, session_id: str) -> Optional[Session]:
        """Restore session from vault"""
        session = await queries.get_session(session_id)
        if not session:
            return None

        if session.is_expired:
            await queries.delete_session(session_id)
            return None

        token = self._decrypt_token(session.token_encrypted)
        self.client.set_token(token)
        self._current_session = session
        return session

    async def logout(self):
        """Logout and clear session"""
        if self._current_session:
            try:
                await self.client.signout()
            except Exception:
                pass

            await queries.delete_session(self._current_session.id)
            self._current_session = None
            self.client.clear_token()

    async def validate(self) -> bool:
        """Validate current session with server"""
        if not self._current_session:
            return False

        try:
            response = await self.client.get_session()
            return response.status_code == 200
        except Exception:
            return False
```

---

## CLI Login Flow: commands/login.py

```python
"""Login command implementation"""

import click
import getpass

from criptenv.crypto import generate_salt
from criptenv.vault import queries
from criptenv.session import SessionManager


@click.command(name="login")
@click.option("--email", "-e", required=True, help="Your email")
@click.option("--password", "-p", help="Your password (will prompt if not provided)")
def login(email: str, password: str):
    """Login to CriptEnv"""

    if not password:
        password = getpass.getpass("Password: ")

    if not password:
        click.echo("Error: Password required", err=True)
        return

    try:
        import asyncio

        async def do_login():
            salt_hex = await queries.get_config("master_salt")
            if not salt_hex:
                click.echo("Error: Run 'criptenv init' first to set up master password")
                return

            from criptenv.crypto import derive_master_key
            salt = bytes.fromhex(salt_hex)
            master_key = derive_master_key(password, salt)

            manager = SessionManager(master_key)
            session = await manager.login(email, password)
            return session

        session = asyncio.run(do_login())
        if session:
            click.echo(f"Logged in as {email}")

    except ValueError as e:
        click.echo(f"Login failed: {e}", err=True)
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
```

---

## Init Flow: commands/init.py

```python
"""Init command implementation"""

import click
import getpass

from criptenv.crypto import generate_salt, derive_master_key
from criptenv.vault import queries
from criptenv.config import CONFIG_DIR


@click.command(name="init")
@click.option("--force", is_flag=True, help="Overwrite existing config")
def init(force: bool):
    """Initialize CriptEnv configuration"""

    import asyncio

    async def check_init():
        salt = await queries.get_config("master_salt")
        return salt is not None

    already_init = asyncio.run(check_init())

    if already_init and not force:
        click.echo("Already initialized. Use --force to reset.")
        return

    click.echo("Creating new CriptEnv configuration...")
    password = getpass.getpass("Enter master password: ")
    confirm = getpass.getpass("Confirm master password: ")

    if password != confirm:
        click.echo("Passwords don't match", err=True)
        return

    if len(password) < 8:
        click.echo("Password must be at least 8 characters", err=True)
        return

    salt = generate_salt()
    derive_master_key(password, salt)

    async def save_salt():
        await queries.set_config("master_salt", salt.hex())

    asyncio.run(save_salt())

    click.echo(f"Initialized at {CONFIG_DIR}")
    click.echo("Run 'criptenv login' to authenticate")
```

---

## Verification

```bash
# 1. Check API is running
cd apps/api && uvicorn main:app --port 8000 &

# 2. Test login flow
criptenv init
criptenv login --email test@example.com --password testpass123

# 3. Verify session stored
ls -la ~/.criptenv/
sqlite3 ~/.criptenv/vault.db "SELECT id, email FROM sessions"

# 4. Cleanup
pkill -f uvicorn
```

---

## Error Handling

| Error               | User Message                          | Action                                    |
| ------------------- | ------------------------------------- | ----------------------------------------- |
| Network unreachable | "Cannot connect to API server"        | Check API_BASE_URL                        |
| Invalid credentials | "Invalid email or password"           | Retry with correct credentials            |
| Session expired     | "Session expired, please login again" | Clear session, prompt re-login            |
| Password wrong      | "Invalid master password"             | Cannot decrypt session, re-enter password |

---

**Previous**: [M1-3-LOCAL-VAULT.md](M1-3-LOCAL-VAULT.md)
**Next**: [M1-5-CORE-COMMANDS.md](M1-5-CORE-COMMANDS.md)
