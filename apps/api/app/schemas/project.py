from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class ProjectVaultConfig(BaseModel):
    version: int = Field(default=1, ge=1)
    kdf: str = Field(default="PBKDF2-SHA256")
    iterations: int = Field(default=100000, ge=100000)
    salt: str = Field(..., min_length=1)
    proof_salt: str = Field(..., min_length=1)
    verifier_iv: str = Field(..., min_length=1)
    verifier_ciphertext: str = Field(..., min_length=1)
    verifier_auth_tag: str = Field(..., min_length=1)


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255, pattern=r'^[a-z0-9-]+$')
    description: Optional[str] = None
    encryption_key_id: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    vault_config: ProjectVaultConfig
    vault_proof: str = Field(..., min_length=1)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    archived: Optional[bool] = None


class ProjectResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    encryption_key_id: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    vault_config: Optional[ProjectVaultConfig] = None
    archived: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_project(cls, project):
        settings = dict(getattr(project, "settings", None) or {})
        vault_settings = settings.pop("vault", None)
        vault_config = None

        if isinstance(vault_settings, dict):
            public_vault = {
                key: value
                for key, value in vault_settings.items()
                if key != "proof_hash"
            }
            if public_vault:
                vault_config = ProjectVaultConfig.model_validate(public_vault)

        return cls(
            id=project.id,
            owner_id=project.owner_id,
            name=project.name,
            slug=project.slug,
            description=project.description,
            encryption_key_id=project.encryption_key_id,
            settings=settings or None,
            vault_config=vault_config,
            archived=project.archived,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )

    class Config:
        from_attributes = True


class EnvironmentVaultBlobs(BaseModel):
    environment_id: UUID
    blobs: list[dict]


class ProjectVaultRekeyRequest(BaseModel):
    current_vault_proof: str = Field(..., min_length=1)
    new_vault_config: ProjectVaultConfig
    new_vault_proof: str = Field(..., min_length=1)
    environments: list[EnvironmentVaultBlobs]


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int
