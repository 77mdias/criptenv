from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.schemas.overview import SecretMatrixResponse
from app.services.overview_service import OverviewService
from app.services.project_service import ProjectService
from app.services.audit_service import AuditService
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectListResponse,
    ProjectVaultRekeyRequest,
)
from app.services.vault_service import VaultService
from app.middleware.auth import AuthContext, get_current_auth_context, get_current_user
from app.middleware.api_key_auth import require_api_key_project
from app.models.user import User

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    request: Request,
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project = await project_service.create_project(
            owner_id=current_user.id,
            name=payload.name,
            slug=payload.slug,
            description=payload.description,
            encryption_key_id=payload.encryption_key_id,
            settings=payload.settings,
            vault_config=payload.vault_config,
            vault_proof=payload.vault_proof,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project with this name already exists"
        )

    await db.flush()
    await db.refresh(project)

    # Force load all attributes
    _ = project.id
    _ = project.owner_id
    _ = project.name
    _ = project.slug
    _ = project.description
    _ = project.encryption_key_id
    _ = project.settings
    _ = project.archived
    _ = project.created_at
    _ = project.updated_at

    await audit_service.log(
        action="project.created",
        resource_type="project",
        resource_id=project.id,
        user_id=current_user.id,
        project_id=project.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return ProjectResponse.from_project(project, current_user_role="owner")


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    include_archived: bool = False,
    auth_context: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db)
):
    project_service = ProjectService(db)
    project_rows = await project_service.list_user_projects_with_roles(
        user_id=auth_context.user.id,
        include_archived=include_archived
    )
    if auth_context.auth_type == "api_key" and auth_context.api_key is not None:
        # An API key only ever sees the project it was created for.
        key_project_id = str(auth_context.api_key.project_id)
        project_rows = [
            (project, role) for project, role in project_rows
            if str(project.id) == key_project_id
        ]

    return ProjectListResponse(
        projects=[
            ProjectResponse.from_project(project, current_user_role=role)
            for project, role in project_rows
        ],
        total=len(project_rows)
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    auth_context: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db)
):
    from uuid import UUID

    project_service = ProjectService(db)

    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID"
        )

    if auth_context.auth_type == "api_key" and auth_context.api_key is not None:
        require_api_key_project(auth_context.api_key, project_uuid)

    member = await project_service.check_user_access(auth_context.user.id, project_uuid)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    project = await project_service.get_project(project_uuid)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    return ProjectResponse.from_project(project, current_user_role=member.role)


@router.get("/{project_id}/secrets/matrix", response_model=SecretMatrixResponse)
async def get_secret_matrix(
    project_id: str,
    auth_context: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db)
):
    """Which keys exist in which environment (names and versions only, no ciphertext)."""
    from uuid import UUID

    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project ID")

    api_key = auth_context.api_key if auth_context.auth_type == "api_key" else None
    if api_key is not None:
        require_api_key_project(api_key, project_uuid)

    if not await ProjectService(db).check_user_access(auth_context.user.id, project_uuid):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    matrix = await OverviewService(db).get_secret_matrix(project_uuid)

    environment_scope = getattr(api_key, "environment_scope", None) if api_key is not None else None
    if environment_scope is not None:
        # An environment-scoped key must not learn key names of other environments.
        allowed = {str(env["id"]) for env in matrix["environments"] if env["name"] == environment_scope}
        matrix["environments"] = [env for env in matrix["environments"] if str(env["id"]) in allowed]
        keys = []
        for row in matrix["keys"]:
            cells = {env_id: cell for env_id, cell in row["cells"].items() if env_id in allowed}
            if any(cell is not None for cell in cells.values()):
                keys.append({"key_id": row["key_id"], "cells": cells})
        matrix["keys"] = keys
    return matrix


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    request: Request,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from uuid import UUID

    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )

    project = await project_service.update_project(
        project_id=project_uuid,
        name=payload.name,
        description=payload.description,
        settings=payload.settings,
        archived=payload.archived
    )

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    await audit_service.log(
        action="project.updated",
        resource_type="project",
        resource_id=project.id,
        user_id=current_user.id,
        project_id=project.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return ProjectResponse.from_project(project, current_user_role=member.role)


@router.post("/{project_id}/vault/rekey", response_model=ProjectResponse)
async def rekey_project_vault(
    project_id: str,
    request: Request,
    payload: ProjectVaultRekeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from uuid import UUID

    project_service = ProjectService(db)
    vault_service = VaultService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid, "admin")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )

    project = await project_service.get_project(project_uuid)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    if not project_service.verify_vault_proof(project, payload.current_vault_proof):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid vault password"
        )

    try:
        for environment_payload in payload.environments:
            await vault_service.push_blobs(
                project_id=project_uuid,
                environment_id=environment_payload.environment_id,
                blobs=environment_payload.blobs,
            )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

    project = await project_service.update_vault_settings(
        project_id=project_uuid,
        vault_config=payload.new_vault_config,
        vault_proof=payload.new_vault_proof,
    )

    await audit_service.log(
        action="project.vault_rekeyed",
        resource_type="project",
        resource_id=project_uuid,
        user_id=current_user.id,
        project_id=project_uuid,
        metadata={"environment_count": len(payload.environments)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return ProjectResponse.from_project(project, current_user_role=member.role)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from uuid import UUID

    project_service = ProjectService(db)
    audit_service = AuditService(db)

    try:
        project_uuid = UUID(project_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid project ID"
        )

    member = await project_service.check_user_access(current_user.id, project_uuid, "owner")
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or insufficient permissions"
        )

    project = await project_service.get_project(project_uuid)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )

    await audit_service.log(
        action="project.deleted",
        resource_type="project",
        resource_id=project.id,
        user_id=current_user.id,
        project_id=project.id,
        metadata={"project_name": project.name, "project_slug": project.slug},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    await project_service.delete_project(project_uuid)
