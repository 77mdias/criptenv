"""Render Integration Provider

Integration with Render environment variables API.
https://render.com/docs/api
"""

from typing import Optional
import httpx

from app.strategies.integrations.base import IntegrationProvider, register_provider


@register_provider
class RenderProvider(IntegrationProvider):
    """Render integration for environment variable sync.
    
    Uses Render REST API v1 to push/pull environment variables.
    Authentication via Render API token.
    """
    
    provider_name = "render"
    api_base_url = "https://api.render.com/v1"
    
    @property
    def headers(self) -> dict:
        """Default headers for Render API requests."""
        return {
            "Content-Type": "application/json"
        }
    
    async def push_secrets(
        self,
        secrets: list[dict],
        config: dict,
        environment: str
    ) -> bool:
        """Push secrets to Render environment variables.
        
        Args:
            secrets: List of {key, value, encrypted?} dicts
            config: Must contain 'api_token' and 'service_id'
            environment: Render environment (not used — Render uses env groups)
            
        Returns:
            True if all secrets pushed successfully
        """
        api_token = config.get("api_token")
        service_id = config.get("service_id")
        
        if not api_token or not service_id:
            raise ValueError("Render config requires 'api_token' and 'service_id'")
        
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for secret in secrets:
                payload = {
                    "key": secret["key"],
                    "value": secret["value"]
                }
                
                try:
                    response = await client.post(
                        f"{self.api_base_url}/services/{service_id}/env-vars",
                        headers=headers,
                        json=payload
                    )
                    
                    # 201 = created, 200 = updated, 409 = already exists (ok)
                    if response.status_code not in (200, 201, 409):
                        return False
                        
                except httpx.HTTPError:
                    return False
        
        return True
    
    async def pull_secrets(
        self,
        config: dict,
        environment: str
    ) -> list[dict]:
        """Pull secrets from Render environment variables.
        
        Args:
            config: Must contain 'api_token' and 'service_id'
            environment: Not used for Render (env vars are service-scoped)
            
        Returns:
            List of {key, value} dicts
        """
        api_token = config.get("api_token")
        service_id = config.get("service_id")
        
        if not api_token or not service_id:
            raise ValueError("Render config requires 'api_token' and 'service_id'")
        
        headers = {
            "Authorization": f"Bearer {api_token}"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/services/{service_id}/env-vars",
                    headers=headers
                )
                
                if response.status_code != 200:
                    return []
                
                data = response.json()
                
                return [
                    {"key": env["envVar"]["key"], "value": env["envVar"].get("value", "")}
                    for env in data if env.get("envVar", {}).get("key")
                ]
                
            except httpx.HTTPError:
                return []
    
    async def validate_connection(self, config: dict) -> bool:
        """Validate Render API token by fetching services.
        
        Args:
            config: Must contain 'api_token'
            
        Returns:
            True if token is valid
        """
        api_token = config.get("api_token")
        
        if not api_token:
            return False
        
        headers = {
            "Authorization": f"Bearer {api_token}"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/services",
                    headers=headers,
                    params={"limit": "1"}
                )
                return response.status_code == 200
            except httpx.HTTPError:
                return False
    
    def get_environments(self, config: dict) -> list[str]:
        """Return Render's environments.
        
        Render uses env groups and services rather than named environments.
        We map to production as the default.
        
        Returns:
            ['production']
        """
        return ["production"]
    
    async def get_services(self, config: dict) -> list[dict]:
        """List Render services for the authenticated user.
        
        Args:
            config: Must contain 'api_token'
            
        Returns:
            List of {id, name} dicts
        """
        api_token = config.get("api_token")
        
        if not api_token:
            return []
        
        headers = {
            "Authorization": f"Bearer {api_token}"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/services",
                    headers=headers
                )
                
                if response.status_code != 200:
                    return []
                
                data = response.json()
                return [
                    {"id": s["service"]["id"], "name": s["service"].get("name", "Unknown")}
                    for s in data if s.get("service")
                ]
            except httpx.HTTPError:
                return []
