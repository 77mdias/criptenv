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
        return resp.json()

    async def signup(self, email: str, password: str, name: str) -> dict[str, Any]:
        """POST /api/auth/signup"""
        resp = await self._request(
            "POST",
            "/api/auth/signup",
            json={"email": email, "password": password, "name": name},
        )
        return resp.json()

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

    async def create_project(self, name: str, slug: str | None = None) -> dict[str, Any]:
        """POST /api/v1/projects"""
        payload: dict[str, Any] = {"name": name}
        if slug:
            payload["slug"] = slug
        resp = await self._request("POST", "/api/v1/projects", json=payload)
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
        self, project_id: str, env_id: str, blobs: list[dict]
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/environments/{eid}/vault/push"""
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/environments/{env_id}/vault/push",
            json={"blobs": blobs},
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
