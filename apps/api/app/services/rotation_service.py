"""Rotation Service for M3.5 Secret Alerts

Service layer for secret rotation operations, expiration management, and audit logging.

GRASP Patterns:
- Information Expert: Handles all rotation logic
- Pure Fabrication: Service class for business logic
- Protected Variations: Encapsulates rotation policy changes
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.secret_expiration import SecretExpiration, SecretRotation
from app.models.vault import VaultBlob
from app.schemas.secret_expiration import (
    ExpirationCreate,
    ExpirationUpdate,
    RotationRequest,
    RotationStatus,
    RotationHistoryItem,
)


class RotationService:
    """Service for managing secret rotation and expiration.
    
    GRASP Information Expert: Contains all rotation business logic
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_expiration(
        self,
        project_id: UUID,
        environment_id: UUID,
        payload: ExpirationCreate
    ) -> SecretExpiration:
        """Create a new secret expiration record.
        
        Args:
            project_id: Project UUID
            environment_id: Environment UUID
            payload: Expiration configuration
            
        Returns:
            Created SecretExpiration record
        """
        expiration = SecretExpiration(
            project_id=project_id,
            environment_id=environment_id,
            secret_key=payload.secret_key,
            expires_at=payload.expires_at,
            rotation_policy=payload.rotation_policy,
            notify_days_before=payload.notify_days_before,
        )
        
        self.db.add(expiration)
        await self.db.commit()
        await self.db.refresh(expiration)
        
        return expiration
    
    async def get_expiration(
        self,
        project_id: UUID,
        environment_id: UUID,
        secret_key: str
    ) -> Optional[SecretExpiration]:
        """Get expiration record for a specific secret."""
        result = await self.db.execute(
            select(SecretExpiration).where(
                and_(
                    SecretExpiration.project_id == project_id,
                    SecretExpiration.environment_id == environment_id,
                    SecretExpiration.secret_key == secret_key
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def update_expiration(
        self,
        project_id: UUID,
        environment_id: UUID,
        secret_key: str,
        payload: ExpirationUpdate
    ) -> Optional[SecretExpiration]:
        """Update an existing expiration record."""
        expiration = await self.get_expiration(project_id, environment_id, secret_key)
        if not expiration:
            return None
        
        if payload.expires_at is not None:
            expiration.expires_at = payload.expires_at
        if payload.rotation_policy is not None:
            expiration.rotation_policy = payload.rotation_policy
        if payload.notify_days_before is not None:
            expiration.notify_days_before = payload.notify_days_before
        
        await self.db.commit()
        await self.db.refresh(expiration)
        
        return expiration
    
    async def list_expirations(
        self,
        project_id: UUID,
        environment_id: Optional[UUID] = None,
        include_expired: bool = True
    ) -> Tuple[List[SecretExpiration], int]:
        """List expirations for a project.
        
        Args:
            project_id: Project UUID
            environment_id: Optional environment filter
            include_expired: Whether to include expired secrets
            
        Returns:
            Tuple of (expirations list, total count)
        """
        conditions = [SecretExpiration.project_id == project_id]
        
        if environment_id:
            conditions.append(SecretExpiration.environment_id == environment_id)
        
        if not include_expired:
            conditions.append(
                or_(
                    SecretExpiration.expires_at > datetime.now(timezone.utc),
                    SecretExpiration.rotated_at.isnot(None)
                )
            )
        
        query = select(SecretExpiration).where(and_(*conditions))
        result = await self.db.execute(query)
        expirations = result.scalars().all()
        
        return list(expirations), len(expirations)
    
    async def list_pending_rotations(self, notify_days: int = 7) -> List[SecretExpiration]:
        """List secrets that need rotation notification.
        
        Args:
            notify_days: Days before expiration to trigger notification
            
        Returns:
            List of SecretExpiration records needing attention
        """
        now = datetime.now(timezone.utc)
        
        result = await self.db.execute(
            select(SecretExpiration).where(
                and_(
                    SecretExpiration.expires_at <= now + timedelta(days=notify_days),
                    SecretExpiration.rotated_at.is_(None),
                    or_(
                        SecretExpiration.last_notified_at.is_(None),
                        SecretExpiration.last_notified_at < now - timedelta(hours=24)
                    )
                )
            )
        )
        
        return list(result.scalars().all())
    
    async def mark_notified(self, expiration_id: UUID) -> None:
        """Mark an expiration record as notified."""
        result = await self.db.execute(
            select(SecretExpiration).where(SecretExpiration.id == expiration_id)
        )
        expiration = result.scalar_one_or_none()
        
        if expiration:
            expiration.last_notified_at = datetime.now(timezone.utc)
            await self.db.commit()
    
    async def rotate_secret(
        self,
        project_id: UUID,
        environment_id: UUID,
        secret_key: str,
        payload: RotationRequest,
        user_id: Optional[UUID] = None
    ) -> Tuple[SecretRotation, int]:
        """Rotate a secret with new encrypted value.
        
        Args:
            project_id: Project UUID
            environment_id: Environment UUID
            secret_key: Secret key identifier
            payload: Rotation request with new encrypted value
            user_id: User performing the rotation (for audit)
            
        Returns:
            Tuple of (rotation record, new version number)
        """
        # Get current vault blob
        result = await self.db.execute(
            select(VaultBlob).where(
                and_(
                    VaultBlob.project_id == project_id,
                    VaultBlob.environment_id == environment_id,
                    VaultBlob.key_id == secret_key
                )
            )
        )
        vault_blob = result.scalar_one_or_none()
        
        if not vault_blob:
            raise ValueError(f"Secret {secret_key} not found in vault")
        
        previous_version = vault_blob.version
        
        # Update vault blob with new encrypted value
        vault_blob.encrypted_value = payload.new_value
        vault_blob.iv = payload.iv
        vault_blob.auth_tag = payload.auth_tag
        vault_blob.version = previous_version + 1 if previous_version else 1
        
        # Create rotation record
        rotation = SecretRotation(
            project_id=project_id,
            environment_id=environment_id,
            secret_key=secret_key,
            previous_version=previous_version,
            new_version=vault_blob.version,
            rotated_by=user_id,
            reason=payload.reason
        )
        self.db.add(rotation)
        
        # Update expiration record if exists
        expiration = await self.get_expiration(project_id, environment_id, secret_key)
        if expiration:
            expiration.rotated_at = datetime.now(timezone.utc)
        
        await self.db.commit()
        await self.db.refresh(rotation)
        
        return rotation, vault_blob.version
    
    async def get_rotation_status(
        self,
        project_id: UUID,
        environment_id: UUID,
        secret_key: str
    ) -> Optional[RotationStatus]:
        """Get rotation status for a secret."""
        # Get expiration record
        expiration = await self.get_expiration(project_id, environment_id, secret_key)
        
        # Get vault blob for version
        result = await self.db.execute(
            select(VaultBlob).where(
                and_(
                    VaultBlob.project_id == project_id,
                    VaultBlob.environment_id == environment_id,
                    VaultBlob.key_id == secret_key
                )
            )
        )
        vault_blob = result.scalar_one_or_none()
        
        if not vault_blob:
            return None
        
        status = RotationStatus(
            secret_key=secret_key,
            current_version=vault_blob.version or 1,
            expires_at=expiration.expires_at if expiration else None,
            rotation_policy=expiration.rotation_policy if expiration else "manual",
            rotated_at=expiration.rotated_at if expiration else None,
            last_notified_at=expiration.last_notified_at if expiration else None,
        )
        
        if expiration:
            status.is_expired = expiration.is_expired
            status.days_until_expiration = expiration.days_until_expiration
            status.needs_rotation = expiration.needs_rotation
        
        return status
    
    async def get_rotation_history(
        self,
        project_id: UUID,
        environment_id: UUID,
        secret_key: str
    ) -> List[RotationHistoryItem]:
        """Get rotation history for a secret."""
        result = await self.db.execute(
            select(SecretRotation).where(
                and_(
                    SecretRotation.project_id == project_id,
                    SecretRotation.environment_id == environment_id,
                    SecretRotation.secret_key == secret_key
                )
            ).order_by(SecretRotation.rotated_at.desc())
        )
        
        rotations = result.scalars().all()
        
        return [
            RotationHistoryItem(
                id=r.id,
                secret_key=r.secret_key,
                previous_version=r.previous_version,
                new_version=r.new_version,
                rotated_by=r.rotated_by,
                rotated_at=r.rotated_at,
                reason=r.reason
            )
            for r in rotations
        ]
    
    async def delete_expiration(
        self,
        project_id: UUID,
        environment_id: UUID,
        secret_key: str
    ) -> bool:
        """Delete an expiration record."""
        expiration = await self.get_expiration(project_id, environment_id, secret_key)
        
        if not expiration:
            return False
        
        await self.db.delete(expiration)
        await self.db.commit()
        
        return True