"""API Key Service for M3.4 Public API

Service layer for API key CRUD operations.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_key import APIKey, generate_api_key, hash_api_key, extract_prefix
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyResponse
from app.services.audit_service import AuditService


class ApiKeyService:
    """Service for managing API keys."""
    
    def __init__(self, db: AsyncSession, user_id: UUID, project_id: UUID):
        self.db = db
        self.user_id = user_id
        self.project_id = project_id
        self.audit_service = AuditService(db)
    
    async def create_api_key(self, payload: ApiKeyCreate) -> tuple[APIKey, str]:
        """Create a new API key.
        
        Returns:
            tuple: (APIKey model, plaintext key)
            
        Note: The plaintext key is only returned once and should be stored
        securely by the client.
        """
        # Generate the plaintext key
        plaintext_key = generate_api_key()
        key_hash = hash_api_key(plaintext_key)
        prefix = extract_prefix(plaintext_key)
        
        # Calculate expiration if specified
        expires_at = None
        if payload.expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
        
        # Create the API key record
        api_key = APIKey(
            user_id=self.user_id,
            project_id=self.project_id,
            name=payload.name,
            description=payload.description,
            prefix=prefix,
            key_hash=key_hash,
            scopes=payload.scopes,
            environment_scope=payload.environment_scope,
            expires_at=expires_at,
            created_by=self.user_id
        )
        
        self.db.add(api_key)
        await self.db.flush()
        await self.db.refresh(api_key)
        
        # Log audit
        await self.audit_service.log(
            action="api_key.created",
            resource_type="api_key",
            resource_id=api_key.id,
            user_id=self.user_id,
            project_id=self.project_id,
            metadata={
                "name": api_key.name,
                "scopes": api_key.scopes
            }
        )
        
        return api_key, plaintext_key
    
    async def list_api_keys(self) -> tuple[list[APIKey], int]:
        """List all API keys for the project (without plaintext)."""
        query = select(APIKey).where(
            and_(
                APIKey.project_id == self.project_id,
                APIKey.revoked_at.is_(None)
            )
        ).order_by(APIKey.created_at.desc())
        
        result = await self.db.execute(query)
        keys = list(result.scalars().all())
        
        return keys, len(keys)
    
    async def get_api_key(self, key_id: UUID) -> Optional[APIKey]:
        """Get a specific API key by ID."""
        query = select(APIKey).where(
            and_(
                APIKey.id == key_id,
                APIKey.project_id == self.project_id
            )
        )
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def revoke_api_key(self, key_id: UUID) -> APIKey:
        """Revoke an API key."""
        api_key = await self.get_api_key(key_id)
        
        if not api_key:
            raise ValueError("API key not found")
        
        if api_key.revoked_at:
            raise ValueError("API key already revoked")
        
        api_key.revoked_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.db.refresh(api_key)
        
        # Log audit
        await self.audit_service.log(
            action="api_key.revoked",
            resource_type="api_key",
            resource_id=api_key.id,
            user_id=self.user_id,
            project_id=self.project_id,
            metadata={"name": api_key.name}
        )
        
        return api_key
    
    async def update_api_key(
        self, key_id: UUID, name: Optional[str] = None,
        scopes: Optional[list[str]] = None
    ) -> APIKey:
        """Update an API key's name or scopes."""
        api_key = await self.get_api_key(key_id)
        
        if not api_key:
            raise ValueError("API key not found")
        
        if api_key.revoked_at:
            raise ValueError("Cannot update revoked API key")
        
        if name:
            api_key.name = name
        if scopes:
            api_key.scopes = scopes
        
        await self.db.flush()
        await self.db.refresh(api_key)
        
        # Log audit
        await self.audit_service.log(
            action="api_key.updated",
            resource_type="api_key",
            resource_id=api_key.id,
            user_id=self.user_id,
            project_id=self.project_id,
            metadata={"name": api_key.name, "scopes": api_key.scopes}
        )
        
        return api_key