"""Vercel Integration Provider

Integration with Vercel environment variables API.
https://vercel.com/docs/rest-api#endpoints/projects-environment-variables
"""

from typing import Optional
import httpx

from app.strategies.integrations.base import IntegrationProvider, register_provider


@register_provider
class VercelProvider(IntegrationProvider):
    """Vercel integration for environment variable sync.
    
    Uses Vercel REST API v10 to push/pull environment variables.
    Authentication via Vercel API token.
    """
    
    provider_name = "vercel"
    api_base_url = "https://api.vercel.com/v10"
    
    @property
    def headers(self) -> dict:
        """Default headers for Vercel API requests."""
        return {
            "Content-Type": "application/json"
        }
    
    async def push_secrets(
        self,
        secrets: list[dict],
        config: dict,
        environment: str
    ) -> bool:
        """Push secrets to Vercel environment variables.
        
        Args:
            secrets: List of {key, value, encrypted?} dicts
            config: Must contain 'api_token' and 'project_id'
            environment: Vercel environment (production, preview, development)
            
        Returns:
            True if all secrets pushed successfully
        """
        api_token = config.get("api_token")
        project_id = config.get("project_id")
        
        if not api_token or not project_id:
            raise ValueError("Vercel config requires 'api_token' and 'project_id'")
        
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            for secret in secrets:
                payload = {
                    "key": secret["key"],
                    "value": secret["value"],
                    "type": "encrypted" if secret.get("encrypted") else "plain",
                    "environment": environment
                }
                
                try:
                    response = await client.post(
                        f"{self.api_base_url}/projects/{project_id}/env",
                        headers=headers,
                        json=payload
                    )
                    
                    # 200 = updated, 201 = created, 409 = already exists (ok)
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
        """Pull secrets from Vercel environment variables.
        
        Args:
            config: Must contain 'api_token' and 'project_id'
            environment: Vercel environment
            
        Returns:
            List of {key, value} dicts
        """
        api_token = config.get("api_token")
        project_id = config.get("project_id")
        
        if not api_token or not project_id:
            raise ValueError("Vercel config requires 'api_token' and 'project_id'")
        
        headers = {
            "Authorization": f"Bearer {api_token}"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    f"{self.api_base_url}/projects/{project_id}/env",
                    headers=headers,
                    params={"environment": environment}
                )
                
                if response.status_code != 200:
                    return []
                
                data = response.json()
                envs = data.get("envs", [])
                
                return [
                    {"key": env["key"], "value": env["value"]}
                    for env in envs if env.get("key")
                ]
                
            except httpx.HTTPError:
                return []
    
    async def validate_connection(self, config: dict) -> bool:
        """Validate Vercel API token by fetching user info.
        
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
                    f"{self.api_base_url}/users/me",
                    headers=headers
                )
                return response.status_code == 200
            except httpx.HTTPError:
                return False
    
    def get_environments(self, config: dict) -> list[str]:
        """Return Vercel's standard environments.
        
        Returns:
            ['production', 'preview', 'development']
        """
        return ["production", "preview", "development"]
    
    async def get_projects(self, config: dict) -> list[dict]:
        """List Vercel projects for the authenticated user.
        
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
                    f"{self.api_base_url}/projects",
                    headers=headers
                )
                
                if response.status_code != 200:
                    return []
                
                data = response.json()
                return [
                    {"id": p["id"], "name": p.get("name", "Unknown")}
                    for p in data.get("projects", [])
                ]
            except httpx.HTTPError:
                return []