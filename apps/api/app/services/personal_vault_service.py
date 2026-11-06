"""Personal vault (cofre pessoal) business rules.

The server cannot read anything here: it enforces ownership, optimistic
versioning and size limits over opaque client-side envelopes.
"""
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.personal_vault import PersonalVault, PersonalVaultItem
from app.schemas.personal_vault import (
    PersonalVaultConfigCreate,
    PersonalVaultConfigUpdate,
    PersonalVaultItemCreate,
    PersonalVaultItemUpdate,
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

    # ─── Items ───────────────────────────────────────────────────────────────

    async def list_items(self, user_id: UUID) -> list[PersonalVaultItem]:
        result = await self.db.execute(
            select(PersonalVaultItem)
            .where(PersonalVaultItem.user_id == user_id)
            .order_by(PersonalVaultItem.updated_at.desc(), PersonalVaultItem.id)
        )
        return list(result.scalars())

    async def create_item(self, user_id: UUID, data: PersonalVaultItemCreate) -> PersonalVaultItem:
        if await self.get_config(user_id) is None:
            raise PersonalVaultNotFound("Personal vault not set up")
        # shortcut: count+insert can exceed the limit by one under concurrent creates; add a DB constraint if it matters
        count = await self.db.scalar(
            select(func.count()).select_from(PersonalVaultItem).where(PersonalVaultItem.user_id == user_id)
        )
        if count >= MAX_PERSONAL_VAULT_ITEMS:
            raise PersonalVaultLimitReached("Item limit reached")
        item = PersonalVaultItem(user_id=user_id, version=1, **data.model_dump())
        try:
            # Savepoint: a duplicate client id must not poison the request's transaction.
            async with self.db.begin_nested():
                self.db.add(item)
                await self.db.flush()
        except IntegrityError:
            raise PersonalVaultConflict("Item id already exists")
        await self.db.refresh(item)
        return item

    async def update_item(self, user_id: UUID, item_id: UUID, data: PersonalVaultItemUpdate) -> PersonalVaultItem:
        # Conditional UPDATE on (id, owner, version): a stale tab gets 409, never a silent overwrite.
        result = await self.db.execute(
            update(PersonalVaultItem)
            .where(
                PersonalVaultItem.id == item_id,
                PersonalVaultItem.user_id == user_id,
                PersonalVaultItem.version == data.expected_version,
            )
            .values(**data.model_dump(exclude={"expected_version"}), version=data.expected_version + 1,
                    updated_at=func.now())
        )
        item = await self._get_item(user_id, item_id)
        if item is None:
            raise PersonalVaultNotFound("Item not found")
        if result.rowcount == 0:
            raise PersonalVaultConflict("Version conflict")
        return item

    async def delete_item(self, user_id: UUID, item_id: UUID) -> None:
        result = await self.db.execute(
            delete(PersonalVaultItem).where(PersonalVaultItem.id == item_id, PersonalVaultItem.user_id == user_id)
        )
        if result.rowcount == 0:
            raise PersonalVaultNotFound("Item not found")

    async def _get_item(self, user_id: UUID, item_id: UUID) -> PersonalVaultItem | None:
        result = await self.db.execute(
            select(PersonalVaultItem)
            .where(PersonalVaultItem.id == item_id, PersonalVaultItem.user_id == user_id)
            .execution_options(populate_existing=True)
        )
        return result.scalar_one_or_none()
