"""Avatar upload service using Supabase Storage REST API via httpx."""

import logging
import uuid
from typing import Optional

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


def _get_storage_config() -> tuple[str, str, str, str]:
    """Return (supabase_url, service_key, anon_key, bucket_name) or raise."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.error("Supabase storage not configured: SUPABASE_URL or SUPABASE_SERVICE_KEY missing")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase storage is not configured on the server.",
        )
    if not settings.SUPABASE_ANON_KEY:
        logger.error("SUPABASE_ANON_KEY is missing or empty")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase anon key is not configured on the server.",
        )
    return (
        settings.SUPABASE_URL.rstrip("/"),
        settings.SUPABASE_SERVICE_KEY,
        settings.SUPABASE_ANON_KEY,
        settings.SUPABASE_AVATAR_BUCKET or "avatars",
    )


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

        supabase_url, service_key, anon_key, bucket = _get_storage_config()
        # Supabase Storage REST API upload endpoint
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{file_name}"
        headers = {
            "Authorization": f"Bearer {service_key}",
            "apikey": anon_key,
            "Content-Type": file.content_type or "application/octet-stream",
            "x-upsert": "true",
        }

        # Debug: log full request details
        logger.info(
            "Supabase upload: url=%s filename=%s content_length=%d apikey=%s... auth=%s...",
            upload_url,
            file_name,
            len(content),
            headers["apikey"][:20] if headers["apikey"] else "EMPTY",
            headers["Authorization"][:20] if headers["Authorization"] else "EMPTY",
        )

        # Try curl first as a workaround for httpx issues with Supabase Storage
        import tempfile
        import subprocess
        import os

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            curl_cmd = [
                "curl", "-s", "-w", "\\n%{http_code}",
                "-X", "POST", upload_url,
                "-H", f"Authorization: Bearer {service_key}",
                "-H", f"apikey: {anon_key}",
                "-H", f"Content-Type: {headers['Content-Type']}",
                "-H", "x-upsert: true",
                "--data-binary", f"@{tmp_path}",
            ]
            logger.info("Running curl: %s", " ".join(curl_cmd[:10]) + " ...")
            result = subprocess.run(curl_cmd, capture_output=True, text=True, timeout=60)
            logger.info("Curl stdout: %s", result.stdout[:500])
            if result.stderr:
                logger.info("Curl stderr: %s", result.stderr[:500])

            # Parse response: last line is HTTP code, rest is body
            lines = result.stdout.strip().split("\n")
            http_code = int(lines[-1]) if lines else 0
            body = "\n".join(lines[:-1]) if len(lines) > 1 else ""

            if http_code in (200, 201):
                public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{file_name}"
                return public_url

            detail = f"Storage error {http_code}: {body}"
            logger.error("Supabase storage upload failed: %s", detail)

            if http_code == 400:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid request to storage: {body}")
            if http_code == 403:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Storage access denied.")
            if http_code == 404:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Storage bucket '{bucket}' not found.")
            if http_code == 413:
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large.")

            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
        finally:
            os.unlink(tmp_path)

    async def delete_avatar(self, user_id: uuid.UUID) -> None:
        """Delete a user's avatar from Supabase Storage.

        Tries to delete both possible extensions since we don't know
        which one was stored.

        Args:
            user_id: The UUID of the user.

        Raises:
            HTTPException: On storage deletion errors.
        """
        supabase_url, service_key, anon_key, bucket = _get_storage_config()
        delete_url = f"{supabase_url}/storage/v1/object/{bucket}"
        headers = {
            "Authorization": f"Bearer {service_key}",
            "apikey": anon_key or service_key,
            "Content-Type": "application/json",
        }

        logger.info(
            "Supabase delete headers: apikey=%s... auth=%s...",
            headers["apikey"][:20] if headers["apikey"] else "EMPTY",
            headers["Authorization"][:20] if headers["Authorization"] else "EMPTY",
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
