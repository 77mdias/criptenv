"""HTTP client for CriptEnv API."""

import httpx
from typing import Optional, Any

from criptenv.config import API_BASE_URL


class CriptEnvAPIError(Exception):
    """API request error."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"API error {status_code}: {detail}")


class CriptEnvClient:
    """Async HTTP client for CriptEnv API."""

    def __init__(
        self,
        base_url: str = API_BASE_URL,
        session_token: Optional[str] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.session_token = session_token

    def set_token(self, token: str):
        """Set session token for authenticated requests."""
        self.session_token = token

    def clear_token(self):
        """Clear session token."""
        self.session_token = None

    @property
    def headers(self) -> dict[str, str]:
        """Build request headers with optional auth."""
        headers = {"Content-Type": "application/json"}
        if self.session_token:
            headers["Authorization"] = f"Bearer {self.session_token}"
        return headers

    async def _request(
        self, method: str, path: str, **kwargs
    ) -> httpx.Response:
        """Make HTTP request and raise on error."""
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method, url, headers=self.headers, **kwargs
            )
        if response.status_code >= 400:
            try:
                detail = response.json().get("detail", response.text)
            except Exception:
                detail = response.text
            raise CriptEnvAPIError(response.status_code, str(detail))
        return response

    # ─── Auth ─────────────────────────────────────────────────────────────────

    async def signin(self, email: str, password: str) -> dict[str, Any]:
        """POST /api/auth/signin"""
        resp = await self._request(
            "POST", "/api/auth/signin", json={"email": email, "password": password}
        )
        data = resp.json()
        token = resp.cookies.get("session_token")
        if token:
            data["token"] = token
        return data

    async def signup(self, email: str, password: str, name: str) -> dict[str, Any]:
        """POST /api/auth/signup"""
        resp = await self._request(
            "POST",
            "/api/auth/signup",
            json={"email": email, "password": password, "name": name},
        )
        data = resp.json()
        token = resp.cookies.get("session_token")
        if token:
            data["token"] = token
        return data

    async def signout(self) -> dict[str, Any]:
        """POST /api/auth/signout"""
        resp = await self._request("POST", "/api/auth/signout")
        return resp.json()

    async def get_session(self) -> dict[str, Any]:
        """GET /api/auth/session"""
        resp = await self._request("GET", "/api/auth/session")
        return resp.json()

    # ─── Projects ─────────────────────────────────────────────────────────────

    async def list_projects(self) -> dict[str, Any]:
        """GET /api/v1/projects"""
        resp = await self._request("GET", "/api/v1/projects")
        return resp.json()

    async def create_project(
        self,
        name: str,
        slug: str | None = None,
        description: str | None = None,
        vault_config: dict[str, Any] | None = None,
        vault_proof: str | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/projects"""
        payload: dict[str, Any] = {"name": name}
        if slug:
            payload["slug"] = slug
        if description:
            payload["description"] = description
        if vault_config is not None:
            payload["vault_config"] = vault_config
        if vault_proof is not None:
            payload["vault_proof"] = vault_proof
        resp = await self._request("POST", "/api/v1/projects", json=payload)
        return resp.json()

    async def get_project(self, project_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}"""
        resp = await self._request("GET", f"/api/v1/projects/{project_id}")
        return resp.json()

    # ─── Environments ─────────────────────────────────────────────────────────

    async def list_environments(self, project_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/environments"""
        resp = await self._request(
            "GET", f"/api/v1/projects/{project_id}/environments"
        )
        return resp.json()

    async def create_environment(
        self, project_id: str, name: str, display_name: str | None = None
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/environments"""
        payload: dict[str, Any] = {"name": name}
        if display_name:
            payload["display_name"] = display_name
        resp = await self._request(
            "POST", f"/api/v1/projects/{project_id}/environments", json=payload
        )
        return resp.json()

    # ─── Vault ────────────────────────────────────────────────────────────────

    async def push_vault(
        self, project_id: str, env_id: str, blobs: list[dict], vault_proof: str | None = None
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/environments/{eid}/vault/push"""
        payload: dict[str, Any] = {"blobs": blobs}
        if vault_proof:
            payload["vault_proof"] = vault_proof
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/environments/{env_id}/vault/push",
            json=payload,
        )
        return resp.json()

    async def pull_vault(self, project_id: str, env_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/environments/{eid}/vault/pull"""
        resp = await self._request(
            "GET", f"/api/v1/projects/{project_id}/environments/{env_id}/vault/pull"
        )
        return resp.json()

    async def get_vault_version(
        self, project_id: str, env_id: str
    ) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/environments/{eid}/vault/version"""
        resp = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/environments/{env_id}/vault/version",
        )
        return resp.json()

    # ─── CI/CD ────────────────────────────────────────────────────────────────

    async def ci_login(self, token: str, project_id: str | None = None) -> dict[str, Any]:
        """POST /api/v1/auth/ci-login
        
        Authenticate with CI token and receive a session token.
        """
        payload: dict[str, Any] = {"token": token}
        if project_id:
            payload["project_id"] = project_id
        resp = await self._request("POST", "/api/v1/auth/ci-login", json=payload)
        return resp.json()

    async def get_ci_secrets(self, project_id: str, environment: str) -> dict[str, Any]:
        """GET /api/v1/ci/secrets
        
        Get secrets for CI/CD workflow (requires session token).
        """
        resp = await self._request(
            "GET",
            f"/api/v1/ci/secrets",
            params={"project_id": project_id, "environment": environment}
        )
        return resp.json()

    async def list_ci_tokens(self, project_id: str, include_revoked: bool = False) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/tokens
        
        List CI tokens for a project.
        """
        resp = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/tokens",
            params={"include_revoked": include_revoked}
        )
        return resp.json()

    async def create_ci_token(
        self,
        project_id: str,
        name: str,
        scopes: list[str],
        environment_scope: str | None = None,
        expires_days: int | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/tokens
        
        Create a new CI token.
        """
        from datetime import datetime, timezone, timedelta
        
        payload: dict[str, Any] = {
            "name": name,
            "scopes": scopes,
        }
        if environment_scope:
            payload["environment_scope"] = environment_scope
        if expires_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)
            payload["expires_at"] = expires_at.isoformat()
        
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/tokens",
            json=payload
        )
        return resp.json()

    async def revoke_ci_token(self, project_id: str, token_id: str) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/tokens/{tid}/revoke
        
        Revoke a CI token.
        """
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/tokens/{token_id}/revoke"
        )
        return resp.json()

    # ─── Integrations ─────────────────────────────────────────────────────────

    async def list_integrations(self, project_id: str) -> list[dict[str, Any]]:
        """GET /api/v1/projects/{id}/integrations"""
        resp = await self._request(
            "GET", f"/api/v1/projects/{project_id}/integrations"
        )
        data = resp.json()
        return data.get("items", [])

    async def sync_integration(
        self, project_id: str, integration_id: str, direction: str = "push"
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/integrations/{iid}/sync"""
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/integrations/{integration_id}/sync",
            json={"direction": direction},
        )
        return resp.json()

    # ─── Rotation (M3.5) ────────────────────────────────────────────────────

    async def rotate_secret(
        self,
        project_id: str,
        env_id: str,
        key: str,
        new_value: str,
        iv: str,
        auth_tag: str,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{pid}/environments/{eid}/secrets/{key}/rotate
        
        Rotate a secret with a new encrypted value.
        """
        payload: dict[str, Any] = {
            "new_value": new_value,
            "iv": iv,
            "auth_tag": auth_tag,
        }
        if reason:
            payload["reason"] = reason
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/environments/{env_id}/secrets/{key}/rotate",
            json=payload
        )
        return resp.json()

    async def set_expiration(
        self,
        project_id: str,
        env_id: str,
        key: str,
        expires_at: str,
        rotation_policy: str = "notify",
        notify_days_before: int = 7,
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{pid}/environments/{eid}/secrets/{key}/expiration
        
        Set or update expiration for a secret.
        """
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/environments/{env_id}/secrets/{key}/expiration",
            json={
                "secret_key": key,
                "expires_at": expires_at,
                "rotation_policy": rotation_policy,
                "notify_days_before": notify_days_before,
            }
        )
        return resp.json()

    async def get_rotation_status(
        self,
        project_id: str,
        env_id: str,
        key: str,
    ) -> dict[str, Any]:
        """GET /api/v1/projects/{pid}/environments/{eid}/secrets/{key}/rotation
        
        Get rotation status for a secret.
        """
        resp = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/environments/{env_id}/secrets/{key}/rotation"
        )
        return resp.json()

    async def list_expiring(
        self,
        project_id: str,
        days: int = 30,
    ) -> dict[str, Any]:
        """GET /api/v1/projects/{pid}/secrets/expiring
        
        List secrets expiring within N days.
        """
        resp = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/secrets/expiring",
            params={"days": days}
        )
        return resp.json()
