"""HTTP client for CriptEnv API."""

import httpx
from typing import Optional, Any

from criptenv.config import API_BASE_URL

REQUEST_TIMEOUT = httpx.Timeout(timeout=30.0, connect=15.0)


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
            try:
                response = await client.request(
                    method,
                    url,
                    headers=self.headers,
                    timeout=kwargs.pop("timeout", REQUEST_TIMEOUT),
                    **kwargs,
                )
            except httpx.TimeoutException as exc:
                raise CriptEnvAPIError(
                    0,
                    f"Timed out connecting to {self.base_url}. "
                    "Check your network and try again.",
                ) from exc
            except httpx.RequestError as exc:
                detail = str(exc) or exc.__class__.__name__
                raise CriptEnvAPIError(
                    0,
                    f"Could not reach {self.base_url}: {detail}",
                ) from exc
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

    async def get_sessions(self) -> dict[str, Any]:
        """GET /api/auth/sessions"""
        resp = await self._request("GET", "/api/auth/sessions")
        return resp.json()

    async def forgot_password(self, email: str) -> dict[str, Any]:
        """POST /api/auth/forgot-password"""
        resp = await self._request("POST", "/api/auth/forgot-password", json={"email": email})
        return resp.json()

    async def reset_password(self, token: str, new_password: str) -> dict[str, Any]:
        """POST /api/auth/reset-password"""
        resp = await self._request(
            "POST", "/api/auth/reset-password", json={"token": token, "new_password": new_password}
        )
        return resp.json()

    async def change_password(self, current_password: str, new_password: str) -> dict[str, Any]:
        """POST /api/auth/change-password"""
        resp = await self._request(
            "POST", "/api/auth/change-password",
            json={"current_password": current_password, "new_password": new_password}
        )
        return resp.json()

    async def update_profile(self, name: str | None = None, email: str | None = None) -> dict[str, Any]:
        """PATCH /api/auth/me"""
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if email is not None:
            payload["email"] = email
        resp = await self._request("PATCH", "/api/auth/me", json=payload)
        return resp.json()

    async def delete_account(self) -> dict[str, Any]:
        """DELETE /api/auth/me"""
        resp = await self._request("DELETE", "/api/auth/me")
        return resp.json()

    async def setup_2fa(self) -> dict[str, Any]:
        """POST /api/auth/2fa/setup"""
        resp = await self._request("POST", "/api/auth/2fa/setup")
        return resp.json()

    async def verify_2fa(self, code: str) -> dict[str, Any]:
        """POST /api/auth/2fa/verify"""
        resp = await self._request("POST", "/api/auth/2fa/verify", json={"code": code})
        return resp.json()

    async def disable_2fa(self, password: str) -> dict[str, Any]:
        """POST /api/auth/2fa/disable"""
        resp = await self._request("POST", "/api/auth/2fa/disable", json={"password": password})
        return resp.json()

    # ─── CLI Auth ───────────────────────────────────────────────────────────────

    async def cli_initiate(self, callback_url: str) -> dict[str, Any]:
        """POST /api/auth/cli/initiate"""
        resp = await self._request(
            "POST", "/api/auth/cli/initiate", json={"callback_url": callback_url}
        )
        return resp.json()

    async def cli_token(self, auth_code: str) -> dict[str, Any]:
        """POST /api/auth/cli/token"""
        resp = await self._request(
            "POST", "/api/auth/cli/token", json={"auth_code": auth_code}
        )
        return resp.json()

    async def device_code(self) -> dict[str, Any]:
        """POST /api/auth/cli/device/code"""
        resp = await self._request("POST", "/api/auth/cli/device/code", json={})
        return resp.json()

    async def device_poll(self, device_code: str) -> dict[str, Any]:
        """POST /api/auth/cli/device/poll"""
        resp = await self._request(
            "POST", "/api/auth/cli/device/poll", json={"device_code": device_code}
        )
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
        self,
        project_id: str,
        env_id: str,
        blobs: list[dict],
        vault_proof: str | None = None,
        expected_version: int | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/environments/{eid}/vault/push"""
        payload: dict[str, Any] = {"blobs": blobs}
        if vault_proof:
            payload["vault_proof"] = vault_proof
        if expected_version is not None:
            payload["expected_version"] = expected_version
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

    async def create_integration(
        self, project_id: str, provider: str, name: str, config: dict[str, Any]
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/integrations"""
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/integrations",
            json={"provider": provider, "name": name, "config": config},
        )
        return resp.json()

    async def delete_integration(self, project_id: str, integration_id: str) -> None:
        """DELETE /api/v1/projects/{id}/integrations/{iid}"""
        await self._request(
            "DELETE",
            f"/api/v1/projects/{project_id}/integrations/{integration_id}"
        )

    async def validate_integration(
        self, project_id: str, integration_id: str
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/integrations/{iid}/validate"""
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/integrations/{integration_id}/validate"
        )
        return resp.json()

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

    async def get_rotation_history(
        self,
        project_id: str,
        env_id: str,
        secret_key: str,
    ) -> dict[str, Any]:
        """GET /api/v1/projects/{pid}/environments/{eid}/secrets/{key}/rotation/history"""
        resp = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/environments/{env_id}/secrets/{secret_key}/rotation/history",
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

    # ─── Members ──────────────────────────────────────────────────────────────

    async def list_members(self, project_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/members"""
        resp = await self._request("GET", f"/api/v1/projects/{project_id}/members")
        return resp.json()

    async def add_member(self, project_id: str, user_id: str, role: str) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/members"""
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/members",
            json={"user_id": user_id, "role": role},
        )
        return resp.json()

    async def update_member(self, project_id: str, member_id: str, role: str) -> dict[str, Any]:
        """PATCH /api/v1/projects/{id}/members/{mid}"""
        resp = await self._request(
            "PATCH",
            f"/api/v1/projects/{project_id}/members/{member_id}",
            json={"role": role},
        )
        return resp.json()

    async def remove_member(self, project_id: str, member_id: str) -> None:
        """DELETE /api/v1/projects/{id}/members/{mid}"""
        await self._request("DELETE", f"/api/v1/projects/{project_id}/members/{member_id}")

    # ─── Invites ──────────────────────────────────────────────────────────────

    async def list_invites(self, project_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/invites"""
        resp = await self._request("GET", f"/api/v1/projects/{project_id}/invites")
        return resp.json()

    async def create_invite(self, project_id: str, email: str, role: str) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/invites"""
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/invites",
            json={"email": email, "role": role},
        )
        return resp.json()

    async def revoke_invite(self, project_id: str, invite_id: str) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/invites/{iid}/revoke"""
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/invites/{invite_id}/revoke"
        )
        return resp.json()

    async def accept_invite(self, project_id: str, invite_id: str) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/invites/{iid}/accept"""
        resp = await self._request(
            "POST", f"/api/v1/projects/{project_id}/invites/{invite_id}/accept"
        )
        return resp.json()

    async def delete_invite(self, project_id: str, invite_id: str) -> None:
        """DELETE /api/v1/projects/{id}/invites/{iid}"""
        await self._request("DELETE", f"/api/v1/projects/{project_id}/invites/{invite_id}")

    # ─── Audit ────────────────────────────────────────────────────────────────

    async def list_audit(
        self,
        project_id: str,
        action: str | None = None,
        resource_type: str | None = None,
        page: int = 1,
        per_page: int = 50,
    ) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/audit"""
        params: dict[str, Any] = {"page": page, "per_page": per_page}
        if action:
            params["action"] = action
        if resource_type:
            params["resource_type"] = resource_type
        resp = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/audit",
            params=params,
        )
        return resp.json()

    # ─── Projects ─────────────────────────────────────────────────────────────

    async def update_project(
        self,
        project_id: str,
        name: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        """PATCH /api/v1/projects/{id}"""
        payload: dict[str, Any] = {}
        if name:
            payload["name"] = name
        if description:
            payload["description"] = description
        resp = await self._request(
            "PATCH",
            f"/api/v1/projects/{project_id}",
            json=payload,
        )
        return resp.json()

    async def delete_project(self, project_id: str) -> None:
        """DELETE /api/v1/projects/{id}"""
        await self._request("DELETE", f"/api/v1/projects/{project_id}")

    async def rekey_project(
        self,
        project_id: str,
        current_vault_proof: str,
        new_vault_config: dict[str, Any],
        new_vault_proof: str,
        environments: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/vault/rekey"""
        payload = {
            "current_vault_proof": current_vault_proof,
            "new_vault_config": new_vault_config,
            "new_vault_proof": new_vault_proof,
            "environments": environments,
        }
        resp = await self._request(
            "POST", f"/api/v1/projects/{project_id}/vault/rekey", json=payload
        )
        return resp.json()

    # ─── API Keys ─────────────────────────────────────────────────────────────

    async def list_api_keys(self, project_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/api-keys"""
        resp = await self._request("GET", f"/api/v1/projects/{project_id}/api-keys")
        return resp.json()

    async def create_api_key(
        self,
        project_id: str,
        name: str,
        scopes: list[str] | None = None,
        environment_scope: str | None = None,
        expires_in_days: int | None = None,
    ) -> dict[str, Any]:
        """POST /api/v1/projects/{id}/api-keys"""
        payload: dict[str, Any] = {"name": name}
        if scopes:
            payload["scopes"] = scopes
        if environment_scope:
            payload["environment_scope"] = environment_scope
        if expires_in_days:
            payload["expires_in_days"] = expires_in_days
        resp = await self._request(
            "POST",
            f"/api/v1/projects/{project_id}/api-keys",
            json=payload,
        )
        return resp.json()

    async def revoke_api_key(self, project_id: str, key_id: str) -> dict[str, Any]:
        """DELETE /api/v1/projects/{id}/api-keys/{kid}"""
        resp = await self._request(
            "DELETE",
            f"/api/v1/projects/{project_id}/api-keys/{key_id}"
        )
        return resp.json()

    # ─── Environments ─────────────────────────────────────────────────────────

    async def update_environment(
        self,
        project_id: str,
        env_id: str,
        name: str | None = None,
        display_name: str | None = None,
    ) -> dict[str, Any]:
        """PATCH /api/v1/projects/{id}/environments/{eid}"""
        payload: dict[str, Any] = {}
        if name:
            payload["name"] = name
        if display_name:
            payload["display_name"] = display_name
        resp = await self._request(
            "PATCH",
            f"/api/v1/projects/{project_id}/environments/{env_id}",
            json=payload,
        )
        return resp.json()

    async def get_environment(self, project_id: str, env_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/environments/{eid}"""
        resp = await self._request(
            "GET", f"/api/v1/projects/{project_id}/environments/{env_id}"
        )
        return resp.json()

    async def delete_environment(self, project_id: str, env_id: str) -> None:
        """DELETE /api/v1/projects/{id}/environments/{eid}"""
        await self._request(
            "DELETE",
            f"/api/v1/projects/{project_id}/environments/{env_id}"
        )

    # ─── Missing Methods (Wave 4) ─────────────────────────────────────────────

    async def list_ci_secrets_keys(self, project_id: str, environment: str) -> dict[str, Any]:
        """GET /api/v1/ci/secrets/list"""
        resp = await self._request(
            "GET",
            "/api/v1/ci/secrets/list",
            params={"project_id": project_id, "environment": environment}
        )
        return resp.json()

    async def delete_ci_token(self, project_id: str, token_id: str) -> None:
        """DELETE /api/v1/projects/{id}/tokens/{tid}"""
        await self._request(
            "DELETE",
            f"/api/v1/projects/{project_id}/tokens/{token_id}"
        )

    async def get_integration(self, project_id: str, integration_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/integrations/{iid}"""
        resp = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/integrations/{integration_id}"
        )
        return resp.json()

    async def delete_expiration(self, project_id: str, env_id: str, secret_key: str) -> dict[str, Any]:
        """DELETE /api/v1/projects/{id}/environments/{eid}/secrets/{key}/expiration"""
        resp = await self._request(
            "DELETE",
            f"/api/v1/projects/{project_id}/environments/{env_id}/secrets/{secret_key}/expiration"
        )
        return resp.json()

    async def get_api_key(self, project_id: str, key_id: str) -> dict[str, Any]:
        """GET /api/v1/projects/{id}/api-keys/{kid}"""
        resp = await self._request(
            "GET",
            f"/api/v1/projects/{project_id}/api-keys/{key_id}"
        )
        return resp.json()

    async def update_api_key(
        self,
        project_id: str,
        key_id: str,
        name: str | None = None,
        scopes: list[str] | None = None,
        environment_scope: str | None = None,
    ) -> dict[str, Any]:
        """PATCH /api/v1/projects/{id}/api-keys/{kid}"""
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if scopes is not None:
            payload["scopes"] = scopes
        if environment_scope is not None:
            payload["environment_scope"] = environment_scope
        resp = await self._request(
            "PATCH",
            f"/api/v1/projects/{project_id}/api-keys/{key_id}",
            json=payload,
        )
        return resp.json()

    async def list_oauth_accounts(self) -> list[dict[str, Any]]:
        """GET /api/auth/oauth/accounts"""
        resp = await self._request("GET", "/api/auth/oauth/accounts")
        return resp.json()

    async def unlink_oauth_account(self, provider: str) -> dict[str, Any]:
        """DELETE /api/auth/oauth/{provider}"""
        resp = await self._request("DELETE", f"/api/auth/oauth/{provider}")
        return resp.json()
