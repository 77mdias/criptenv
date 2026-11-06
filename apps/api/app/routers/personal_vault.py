"""Personal vault (cofre pessoal) routes: web dashboard only (cookie auth)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_web_user
from app.models.user import User
from app.schemas.personal_vault import (
    PersonalVaultConfigCreate,
    PersonalVaultConfigResponse,
    PersonalVaultConfigUpdate,
)
from app.services.personal_vault_service import (
    PersonalVaultConflict,
    PersonalVaultLimitReached,
    PersonalVaultNotFound,
    PersonalVaultService,
)

router = APIRouter(prefix="/api/v1/personal-vault", tags=["Personal Vault"])


def _http(exc: Exception) -> HTTPException:
    code = status.HTTP_404_NOT_FOUND if isinstance(exc, PersonalVaultNotFound) else status.HTTP_409_CONFLICT
    return HTTPException(status_code=code, detail=str(exc))


_ERRORS = (PersonalVaultNotFound, PersonalVaultConflict, PersonalVaultLimitReached)


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
