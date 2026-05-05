from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID


class VaultBlobPush(BaseModel):
    key_id: str = Field(..., min_length=1)
    iv: Any  # base64-encoded bytes
    ciphertext: Any  # base64-encoded bytes
    auth_tag: Any  # base64-encoded bytes
    checksum: str = Field(..., min_length=1)
    version: int = Field(..., ge=1)


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
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VaultPushRequest(BaseModel):
    blobs: list[VaultBlobPush]
    vault_proof: Optional[str] = None


class VaultPullResponse(BaseModel):
    blobs: list[VaultBlobPull]
    version: int


class VaultConflictError(BaseModel):
    message: str = "Version conflict detected"
    current_version: int
    expected_version: int
