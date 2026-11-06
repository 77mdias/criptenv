"""Personal vault schemas. The server never sees plaintext: it only checks
envelope shapes and sizes, and that the client used a strong enough KDF."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# AES-GCM: 12-byte IV and 16-byte tag, base64-encoded.
_IV = Field(..., min_length=16, max_length=16)
_TAG = Field(..., min_length=24, max_length=24)


class EncryptedSummary(BaseModel):
    """Small envelope: item summaries and wrapped keys."""
    iv: str = _IV
    ciphertext: str = Field(..., min_length=1, max_length=4096)
    auth_tag: str = _TAG


class EncryptedBody(BaseModel):
    iv: str = _IV
    ciphertext: str = Field(..., min_length=1, max_length=65_536)
    auth_tag: str = _TAG


class PersonalVaultConfigCreate(BaseModel):
    kdf: Literal["PBKDF2-SHA256"]
    iterations: int = Field(..., ge=600_000, le=10_000_000)
    master_salt: str = Field(..., min_length=44, max_length=44)
    extra_salt: str = Field(..., min_length=44, max_length=44)
    master_wrapped_vault_key: EncryptedSummary
    recovery_wrapped_vault_key: EncryptedSummary
    extra_wrapped_protected_key: EncryptedSummary
    recovery_wrapped_protected_key: EncryptedSummary


class PersonalVaultConfigUpdate(PersonalVaultConfigCreate):
    expected_version: int = Field(..., ge=1)


class PersonalVaultConfigResponse(PersonalVaultConfigCreate):
    model_config = ConfigDict(from_attributes=True)

    version: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PersonalVaultItemFields(BaseModel):
    protected: bool = False
    summary: EncryptedSummary
    body: EncryptedBody


class PersonalVaultItemCreate(PersonalVaultItemFields):
    # Minted by the client: envelopes are bound to it (AES-GCM AAD) before upload.
    id: UUID


class PersonalVaultItemUpdate(PersonalVaultItemFields):
    expected_version: int = Field(..., ge=1)


class PersonalVaultItemResponse(PersonalVaultItemFields):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version: int
    created_at: datetime | None = None
    updated_at: datetime | None = None
