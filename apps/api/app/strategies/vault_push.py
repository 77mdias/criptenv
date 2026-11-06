from typing import Protocol
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vault import VaultBlob


class VaultPushStrategy(Protocol):
    async def push(
        self,
        db: AsyncSession,
        project_id: UUID,
        environment_id: UUID,
        blobs: list[dict],
        version: int,
    ) -> list[VaultBlob]:
        ...


class ReplaceAllVaultBlobsStrategy:
    async def push(
        self,
        db: AsyncSession,
        project_id: UUID,
        environment_id: UUID,
        blobs: list[dict],
        version: int,
    ) -> list[VaultBlob]:
        previous_kinds = dict(
            (
                await db.execute(
                    select(VaultBlob.key_id, VaultBlob.kind).where(
                        VaultBlob.environment_id == environment_id
                    )
                )
            ).all()
        )
        await db.execute(
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
                version=version,
                checksum=blob_data["checksum"],
                kind=blob_data.get("kind") or previous_kinds.get(blob_data["key_id"], "config"),
            )
            db.add(blob)
            created_blobs.append(blob)

        return created_blobs

