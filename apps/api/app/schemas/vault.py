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
    # None: never chosen (from before kinds existed); clients show it as config and send no kind.
    kind: Optional[SecretKind] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VaultPushRequest(BaseModel):
    blobs: list[VaultBlobPush]
    vault_proof: Optional[str] = None
    expected_version: Optional[int] = Field(default=None, ge=0)
    # Child environments only: inherited key names to hide. None keeps the ones it has; [] clears them.
    unset_keys: Optional[list[str]] = Field(default=None, max_length=1000)


class VaultPullResponse(BaseModel):
    """The environment's own blobs (a child's overrides only): what a client edits and pushes back."""
    blobs: list[VaultBlobPull]
    version: int
    unset_keys: list[str] = []


class VaultResolvedBlob(VaultBlobPull):
    """A blob that wins for the environment. `environment_id` is the one holding it: decrypt with its key."""
    source_environment_name: str
    origin: Literal["local", "inherited"]


class EnvironmentRef(BaseModel):
    id: UUID
    name: str


class VaultResolvedResponse(BaseModel):
    """What the environment resolves to through its parents: what `run` injects. Read-only."""
    blobs: list[VaultResolvedBlob]
    version: int
    environment_id: UUID
    environment_name: str
    unset_keys: list[str] = []
    # [the environment, its parent, ...]
    chain: list[EnvironmentRef]


class VaultConflictError(BaseModel):
    message: str = "Version conflict detected"
    current_version: int
    expected_version: int
