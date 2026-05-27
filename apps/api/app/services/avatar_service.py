"""Avatar upload service using Supabase Storage REST API via httpx."""

import json
import logging
import uuid
from typing import Optional
from urllib.parse import urlparse

from fastapi import UploadFile, HTTPException, status
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Valid image MIME types and extensions
VALID_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def _detect_image_format(data: bytes) -> Optional[str]:
    """Detect image format from magic numbers.

    Returns 'png', 'jpeg', or None.
    """
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8"):
        return "jpeg"
    return None


async def _validate_image(file: UploadFile) -> tuple[bytes, str]:
    """Validate image file and return content + extension.

    Returns:
        Tuple of (file content, extension with dot e.g., '.png')

    Raises:
        HTTPException: If the file is not a valid image or exceeds size limits.
    """
    content_type = file.content_type or ""
    if content_type not in VALID_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image type: {content_type!r}. Only PNG and JPG are allowed.",
        )

    # Use FastAPI's async read API (handles seek internally)
    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file received.",
        )

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    img_type = _detect_image_format(content)
    if img_type not in {"png", "jpeg"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Only PNG and JPG files are allowed.",
        )

    ext = ".png" if img_type == "png" else ".jpg"
    return content, ext


def _normalize_supabase_url(raw_url: str) -> str:
    """Validate and normalize the Supabase project base URL."""
    supabase_url = raw_url.strip().rstrip("/")
    parsed = urlparse(supabase_url)
    path = parsed.path.rstrip("/")

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        logger.error("Invalid SUPABASE_URL configured for avatar storage")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_URL must be a valid Supabase project base URL.",
        )

    if path or parsed.query or parsed.fragment:
        logger.error("SUPABASE_URL must not include a path, query, or fragment")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "SUPABASE_URL must be the project base URL, for example "
                "https://your-project.supabase.co. Remove extra path/query data "
                f"from configured value: {path or parsed.query or parsed.fragment}"
            ),
        )

    return supabase_url


def _get_storage_config() -> tuple[str, str, str]:
    """Return (supabase_url, service_key, bucket_name) or raise."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.error("Supabase storage not configured: SUPABASE_URL or SUPABASE_SERVICE_KEY missing")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase storage is not configured on the server.",
        )
    return (
        _normalize_supabase_url(settings.SUPABASE_URL),
        settings.SUPABASE_SERVICE_KEY,
        settings.SUPABASE_AVATAR_BUCKET or "avatars",
    )


def _storage_error_message(body: str) -> str:
    """Extract a useful Storage error message without exposing credentials."""
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return body[:500] if body else "No response body."

    if isinstance(data, dict):
        message = data.get("message") or data.get("error") or body
        code = data.get("code")
        return f"{code}: {message}" if code else str(message)

    return body[:500] if body else "No response body."


class AvatarService:
    """Service for managing user avatars via Supabase Storage REST API."""

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def upload_avatar(self, user_id: uuid.UUID, file: UploadFile) -> str:
        """Upload or replace a user's avatar image.

        Uses upsert (overwrite) to keep storage clean (one image per user).

        Args:
            user_id: The UUID of the user.
            file: The uploaded image file.

        Returns:
            The public URL of the uploaded avatar.

        Raises:
            HTTPException: On validation or upload errors.
        """
        content, ext = await _validate_image(file)
        file_name = f"{user_id}{ext}"

        supabase_url, service_key, bucket = _get_storage_config()
        # Supabase Storage REST API upload endpoint
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{file_name}"
        headers = {
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": file.content_type or "application/octet-stream",
            "x-upsert": "true",
        }

        logger.info(
            "Supabase avatar upload: url=%s bucket=%s filename=%s content_length=%d",
            upload_url,
            bucket,
            file_name,
            len(content),
        )

        client = self._get_client()
        try:
            response = await client.post(upload_url, content=content, headers=headers)
        except httpx.HTTPError as exc:
            logger.error("Supabase storage upload request failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Supabase Storage upload failed: network error.",
            ) from exc

        logger.info(
            "Supabase avatar upload completed: status=%d filename=%s",
            response.status_code,
            file_name,
        )

        if response.status_code in (200, 201):
            return f"{supabase_url}/storage/v1/object/public/{bucket}/{file_name}"

        error_message = _storage_error_message(response.text)
        logger.error(
            "Supabase storage upload failed: status=%d error=%s",
            response.status_code,
            error_message,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Supabase Storage upload failed ({response.status_code}): {error_message}",
        )

    async def delete_avatar(self, user_id: uuid.UUID) -> None:
        """Delete a user's avatar from Supabase Storage.

        Tries to delete both possible extensions since we don't know
        which one was stored.

        Args:
            user_id: The UUID of the user.

        Raises:
            HTTPException: On storage deletion errors.
        """
        supabase_url, service_key, bucket = _get_storage_config()
        delete_url = f"{supabase_url}/storage/v1/object/{bucket}"
        headers = {
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/json",
        }

        logger.info(
            "Supabase avatar delete: url=%s bucket=%s user_id=%s",
            delete_url,
            bucket,
            user_id,
        )

        paths = [f"{user_id}.png", f"{user_id}.jpg", f"{user_id}.jpeg"]

        client = self._get_client()
        try:
            response = await client.delete(delete_url, json={"prefixes": paths}, headers=headers)
            if response.status_code not in (200, 204, 404):
                logger.warning(
                    "Unexpected status deleting avatar from storage: %s — %s",
                    response.status_code,
                    response.text,
                )
        except httpx.HTTPError as exc:
            logger.warning("Network error deleting avatar from storage: %s", exc)
            # Non-fatal: we still clear the DB record even if storage delete fails
