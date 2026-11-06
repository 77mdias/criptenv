from pydantic import BaseModel, Field
from typing import Any, Literal, Optional
from datetime import datetime
from uuid import UUID

SecretKind = Literal["config", "secret"]


class VaultBlobPush(BaseModel):
    key_id: str = Field(..., min_length=1)
    iv: Any  # base64-encoded bytes
    ciphertext: Any  # base64-encoded bytes
    auth_tag: Any  # base64-encoded bytes
    checksum: str = Field(..., min_length=1)
    version: int = Field(..., ge=1)
    # None keeps the kind this key_id already had in the environment (config when new).
    kind: Optional[SecretKind] = None


class VaultBlobPull(BaseModel):
    id: UUID
    project_id: UUID
    environment_id: UUID
    key_id: str
    iv: Any
    ciphertext: Any
    auth_tag: Any
    version: int
    checksum: str
    kind: SecretKind
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VaultPushRequest(BaseModel):
    blobs: list[VaultBlobPush]
    vault_proof: Optional[str] = None
    expected_version: Optional[int] = Field(default=None, ge=0)


class VaultPullResponse(BaseModel):
    blobs: list[VaultBlobPull]
    version: int


class VaultConflictError(BaseModel):
    message: str = "Version conflict detected"
    current_version: int
    expected_version: int
