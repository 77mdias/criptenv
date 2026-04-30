from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vault import VaultBlob
from app.models.environment import Environment


class VaultService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def push_blobs(
        self,
        project_id: UUID,
        environment_id: UUID,
        blobs: list[dict],
        expected_version: Optional[int] = None
    ) -> tuple[list[VaultBlob], bool]:
        env_result = await self.db.execute(
            select(Environment).where(
                Environment.id == environment_id,
                Environment.project_id == project_id
            )
        )
        environment = env_result.scalar_one_or_none()

        if not environment:
            raise ValueError("Environment not found")

        if expected_version is not None and environment.secrets_version != expected_version:
            raise ConflictError(
                current_version=environment.secrets_version,
                expected_version=expected_version
            )

        new_version = environment.secrets_version + 1

        await self.db.execute(
            VaultBlob.__table__.delete().where(
                VaultBlob.environment_id == environment_id
            )
        )

        created_blobs = []
        for blob_data in blobs:
            blob = VaultBlob(
                id=uuid4(),
                project_id=project_id,
                environment_id=environment_id,
                key_id=blob_data["key_id"],
                iv=blob_data["iv"],
                ciphertext=blob_data["ciphertext"],
                auth_tag=blob_data["auth_tag"],
                version=new_version,
                checksum=blob_data["checksum"]
            )
            self.db.add(blob)
            created_blobs.append(blob)

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
        env_result = await self.db.execute(
            select(Environment).where(
                Environment.id == environment_id,
                Environment.project_id == project_id
            )
        )
        environment = env_result.scalar_one_or_none()

        if not environment:
            raise ValueError("Environment not found")

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

    async def get_blob_count(self, environment_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(VaultBlob.id))
            .where(VaultBlob.environment_id == environment_id)
        )
        return result.scalar() or 0

    async def get_environment_version(self, environment_id: UUID) -> int:
        result = await self.db.execute(
            select(Environment.secrets_version)
            .where(Environment.id == environment_id)
        )
        version = result.scalar_one_or_none()
        return version if version is not None else 0


class ConflictError(Exception):
    def __init__(self, current_version: int, expected_version: int):
        self.current_version = current_version
        self.expected_version = expected_version
        super().__init__(
            f"Version conflict: expected {expected_version}, got {current_version}"
        )
