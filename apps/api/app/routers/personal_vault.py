"""Personal vault (cofre pessoal) routes: web dashboard only (cookie auth)."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_web_user
from app.models.user import User
from app.plans import PERSONAL_VAULT_ITEMS, plan_for
from app.schemas.personal_vault import (
    PersonalVaultConfigCreate,
    PersonalVaultConfigResponse,
    PersonalVaultConfigUpdate,
    PersonalVaultItemCreate,
    PersonalVaultItemResponse,
    PersonalVaultItemUpdate,
)
from app.services.personal_vault_service import (
    PersonalVaultConflict,
    PersonalVaultLimitReached,
    PersonalVaultNotFound,
    PersonalVaultService,
)

router = APIRouter(prefix="/api/v1/personal-vault", tags=["Personal Vault"])


_STATUS = {
    PersonalVaultNotFound: status.HTTP_404_NOT_FOUND,
    PersonalVaultConflict: status.HTTP_409_CONFLICT,
    # 402: the web tells a plan limit apart from a version conflict by status alone.
    PersonalVaultLimitReached: status.HTTP_402_PAYMENT_REQUIRED,
}
_ERRORS = tuple(_STATUS)


def _http(exc: Exception) -> HTTPException:
    return HTTPException(status_code=_STATUS[type(exc)], detail=str(exc))


@router.get("/config", response_model=PersonalVaultConfigResponse)
async def get_config(user: User = Depends(get_current_web_user), db: AsyncSession = Depends(get_db)):
    vault = await PersonalVaultService(db).get_config(user.id)
    if vault is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal vault not set up")
    return vault


@router.post("/config", response_model=PersonalVaultConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_config(
    data: PersonalVaultConfigCreate,
    user: User = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await PersonalVaultService(db).create_config(user.id, data)
    except _ERRORS as exc:
        raise _http(exc)


@router.put("/config", response_model=PersonalVaultConfigResponse)
async def update_config(
    data: PersonalVaultConfigUpdate,
    user: User = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await PersonalVaultService(db).update_config(user.id, data)
    except _ERRORS as exc:
        raise _http(exc)


@router.get("/items", response_model=list[PersonalVaultItemResponse])
async def list_items(user: User = Depends(get_current_web_user), db: AsyncSession = Depends(get_db)):
    return await PersonalVaultService(db).list_items(user.id)


@router.post("/items", response_model=PersonalVaultItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: PersonalVaultItemCreate,
    user: User = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        limit = plan_for(user.plan).limits[PERSONAL_VAULT_ITEMS]
        return await PersonalVaultService(db).create_item(user.id, data, limit)
    except _ERRORS as exc:
        raise _http(exc)


@router.put("/items/{item_id}", response_model=PersonalVaultItemResponse)
async def update_item(
    item_id: UUID,
    data: PersonalVaultItemUpdate,
    user: User = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await PersonalVaultService(db).update_item(user.id, item_id, data)
    except _ERRORS as exc:
        raise _http(exc)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    user: User = Depends(get_current_web_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await PersonalVaultService(db).delete_item(user.id, item_id)
    except _ERRORS as exc:
        raise _http(exc)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
