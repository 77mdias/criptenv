"""Personal vault (cofre pessoal) business rules.

The server cannot read anything here: it enforces ownership, optimistic
versioning and size limits over opaque client-side envelopes.
"""
from uuid import UUID

from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.personal_vault import PersonalVault
from app.schemas.personal_vault import (
    PersonalVaultConfigCreate,
    PersonalVaultConfigUpdate,
)

MAX_PERSONAL_VAULT_ITEMS = 1000

_CONFIG_FIELDS = tuple(PersonalVaultConfigCreate.model_fields)


class PersonalVaultNotFound(Exception):
    pass


class PersonalVaultConflict(Exception):
    pass


class PersonalVaultLimitReached(Exception):
    pass


class PersonalVaultService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── Config ──────────────────────────────────────────────────────────────

    async def get_config(self, user_id: UUID) -> PersonalVault | None:
        return await self.db.get(PersonalVault, user_id, populate_existing=True)

    async def create_config(self, user_id: UUID, data: PersonalVaultConfigCreate) -> PersonalVault:
        if await self.get_config(user_id) is not None:
            raise PersonalVaultConflict("Personal vault already exists")
        vault = PersonalVault(user_id=user_id, version=1, **data.model_dump(include=set(_CONFIG_FIELDS)))
        self.db.add(vault)
        await self.db.flush()
        return vault

    async def update_config(self, user_id: UUID, data: PersonalVaultConfigUpdate) -> PersonalVault:
        # Conditional UPDATE: two tabs saving from the same version cannot both win.
        result = await self.db.execute(
            update(PersonalVault)
            .where(PersonalVault.user_id == user_id, PersonalVault.version == data.expected_version)
            .values(**data.model_dump(include=set(_CONFIG_FIELDS)), version=data.expected_version + 1,
                    updated_at=func.now())
        )
        if result.rowcount == 0:
            if await self.get_config(user_id) is None:
                raise PersonalVaultNotFound("Personal vault not set up")
            raise PersonalVaultConflict("Version conflict")
        return await self.get_config(user_id)
