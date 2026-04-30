from typing import Optional
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vault import VaultBlob
from app.models.environment import Environment
from app.strategies.exceptions import VaultConflict
from app.strategies.vault_push import ReplaceAllVaultBlobsStrategy, VaultPushStrategy


class VaultService:
    def __init__(self, db: AsyncSession, push_strategy: VaultPushStrategy | None = None):
        self.db = db
        self.push_strategy = push_strategy or ReplaceAllVaultBlobsStrategy()

    async def _get_active_environment(self, project_id: UUID, environment_id: UUID) -> Environment:
        env_result = await self.db.execute(
            select(Environment).where(
                Environment.id == environment_id,
                Environment.project_id == project_id,
            )
        )
        environment = env_result.scalar_one_or_none()

        if not environment or getattr(environment, "archived", False):
            raise ValueError("Environment not found")

        return environment

    async def push_blobs(
        self,
        project_id: UUID,
        environment_id: UUID,
        blobs: list[dict],
        expected_version: Optional[int] = None
    ) -> tuple[list[VaultBlob], bool]:
        environment = await self._get_active_environment(project_id, environment_id)

        if expected_version is not None and environment.secrets_version != expected_version:
            raise ConflictError(
                current_version=environment.secrets_version,
                expected_version=expected_version
            )

        new_version = environment.secrets_version + 1

        created_blobs = await self.push_strategy.push(
            db=self.db,
            project_id=project_id,
            environment_id=environment_id,
            blobs=blobs,
            version=new_version
        )

        environment.secrets_version = new_version
        await self.db.flush()

        # Refresh blobs to load server-generated columns
        for blob in created_blobs:
            await self.db.refresh(blob)

        return created_blobs, False

    async def pull_blobs(
        self,
        project_id: UUID,
        environment_id: UUID
    ) -> tuple[list[VaultBlob], int]:
        environment = await self._get_active_environment(project_id, environment_id)

        result = await self.db.execute(
            select(VaultBlob)
            .where(
                VaultBlob.environment_id == environment_id,
                VaultBlob.project_id == project_id
            )
            .order_by(VaultBlob.created_at)
        )
        blobs = list(result.scalars().all())

        return blobs, environment.secrets_version

    async def get_blob_count(self, project_id: UUID, environment_id: UUID) -> int:
        await self._get_active_environment(project_id, environment_id)

        result = await self.db.execute(
            select(func.count(VaultBlob.id))
            .where(
                VaultBlob.environment_id == environment_id,
                VaultBlob.project_id == project_id,
            )
        )
        return result.scalar() or 0

    async def get_environment_version(self, project_id: UUID, environment_id: UUID) -> int:
        environment = await self._get_active_environment(project_id, environment_id)
        return environment.secrets_version


ConflictError = VaultConflict
