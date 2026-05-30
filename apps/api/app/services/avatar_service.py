"""Avatar upload service using configured object storage via httpx."""

import hashlib
import hmac
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, urlparse

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


def _normalize_public_url(raw_url: str) -> str:
    public_url = raw_url.strip().rstrip("/")
    parsed = urlparse(public_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        logger.error("Invalid R2_PUBLIC_URL configured for avatar storage")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="R2_PUBLIC_URL must be a valid public HTTP URL.",
        )
    if parsed.query or parsed.fragment:
        logger.error("R2_PUBLIC_URL must not include a query or fragment")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="R2_PUBLIC_URL must not include a query string or fragment.",
        )
    return public_url


def _get_r2_config() -> tuple[str, str, str, str, str]:
    """Return (endpoint, access_key, secret_key, bucket, public_url) or raise."""
    missing = [
        name
        for name, value in {
            "R2_ACCOUNT_ID": settings.R2_ACCOUNT_ID,
            "R2_ACCESS_KEY_ID": settings.R2_ACCESS_KEY_ID,
            "R2_SECRET_ACCESS_KEY": settings.R2_SECRET_ACCESS_KEY,
            "R2_BUCKET": settings.R2_BUCKET,
            "R2_PUBLIC_URL": settings.R2_PUBLIC_URL,
        }.items()
        if not value
    ]
    if missing:
        logger.error("R2 storage not configured: missing %s", ", ".join(missing))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"R2 storage is not configured on the server: missing {', '.join(missing)}.",
        )

    account_id = settings.R2_ACCOUNT_ID.strip()
    endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    return (
        endpoint,
        settings.R2_ACCESS_KEY_ID.strip(),
        settings.R2_SECRET_ACCESS_KEY.strip(),
        settings.R2_BUCKET.strip(),
        _normalize_public_url(settings.R2_PUBLIC_URL),
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


def _signing_key(secret_key: str, date_stamp: str) -> bytes:
    key = ("AWS4" + secret_key).encode("utf-8")
    date_key = hmac.new(key, date_stamp.encode("utf-8"), hashlib.sha256).digest()
    region_key = hmac.new(date_key, b"auto", hashlib.sha256).digest()
    service_key = hmac.new(region_key, b"s3", hashlib.sha256).digest()
    return hmac.new(service_key, b"aws4_request", hashlib.sha256).digest()


def _r2_signed_headers(
    *,
    method: str,
    endpoint: str,
    bucket: str,
    key: str,
    access_key: str,
    secret_key: str,
    payload: bytes,
    content_type: Optional[str] = None,
) -> dict[str, str]:
    """Create AWS SigV4 headers for Cloudflare R2's S3-compatible API."""
    parsed = urlparse(endpoint)
    host = parsed.netloc
    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(payload).hexdigest()
    canonical_uri = f"/{quote(bucket, safe='')}/{quote(key, safe='/')}"

    headers = {
        "host": host,
        "x-amz-content-sha256": payload_hash,
        "x-amz-date": amz_date,
    }
    if content_type:
        headers["content-type"] = content_type

    signed_header_names = sorted(headers)
    canonical_headers = "".join(f"{name}:{headers[name]}\n" for name in signed_header_names)
    signed_headers = ";".join(signed_header_names)
    canonical_request = "\n".join(
        [
            method,
            canonical_uri,
            "",
            canonical_headers,
            signed_headers,
            payload_hash,
        ]
    )
    credential_scope = f"{date_stamp}/auto/s3/aws4_request"
    string_to_sign = "\n".join(
        [
            "AWS4-HMAC-SHA256",
            amz_date,
            credential_scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ]
    )
    signature = hmac.new(
        _signing_key(secret_key, date_stamp),
        string_to_sign.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    auth_header = (
        "AWS4-HMAC-SHA256 "
        f"Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )
    return {**headers, "Authorization": auth_header}


class AvatarService:
    """Service for managing user avatars via configured object storage."""

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

        backend = settings.AVATAR_STORAGE_BACKEND.strip().lower()
        if backend == "r2":
            return await self._upload_avatar_to_r2(file_name, content, file.content_type)
        if backend != "supabase":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AVATAR_STORAGE_BACKEND must be 'supabase' or 'r2'.",
            )

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

    async def _upload_avatar_to_r2(
        self,
        file_name: str,
        content: bytes,
        content_type: Optional[str],
    ) -> str:
        endpoint, access_key, secret_key, bucket, public_url = _get_r2_config()
        upload_url = f"{endpoint}/{bucket}/{quote(file_name, safe='/')}"
        headers = _r2_signed_headers(
            method="PUT",
            endpoint=endpoint,
            bucket=bucket,
            key=file_name,
            access_key=access_key,
            secret_key=secret_key,
            payload=content,
            content_type=content_type or "application/octet-stream",
        )

        logger.info(
            "R2 avatar upload: bucket=%s filename=%s content_length=%d",
            bucket,
            file_name,
            len(content),
        )

        client = self._get_client()
        try:
            response = await client.put(upload_url, content=content, headers=headers)
        except httpx.HTTPError as exc:
            logger.error("R2 storage upload request failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="R2 Storage upload failed: network error.",
            ) from exc

        if response.status_code in (200, 201):
            return f"{public_url}/{file_name}"

        error_message = _storage_error_message(response.text)
        logger.error(
            "R2 storage upload failed: status=%d error=%s",
            response.status_code,
            error_message,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"R2 Storage upload failed ({response.status_code}): {error_message}",
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
        backend = settings.AVATAR_STORAGE_BACKEND.strip().lower()
        if backend == "r2":
            await self._delete_avatar_from_r2(user_id)
            return
        if backend != "supabase":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="AVATAR_STORAGE_BACKEND must be 'supabase' or 'r2'.",
            )

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

    async def _delete_avatar_from_r2(self, user_id: uuid.UUID) -> None:
        endpoint, access_key, secret_key, bucket, _ = _get_r2_config()
        client = self._get_client()

        for path in [f"{user_id}.png", f"{user_id}.jpg", f"{user_id}.jpeg"]:
            delete_url = f"{endpoint}/{bucket}/{quote(path, safe='/')}"
            headers = _r2_signed_headers(
                method="DELETE",
                endpoint=endpoint,
                bucket=bucket,
                key=path,
                access_key=access_key,
                secret_key=secret_key,
                payload=b"",
            )
            try:
                response = await client.delete(delete_url, headers=headers)
                if response.status_code not in (200, 204, 404):
                    logger.warning(
                        "Unexpected status deleting avatar from R2: %s — %s",
                        response.status_code,
                        response.text,
                    )
            except httpx.HTTPError as exc:
                logger.warning("Network error deleting avatar from R2: %s", exc)
