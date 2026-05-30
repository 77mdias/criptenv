"""Tests for avatar uploads."""

from io import BytesIO
from uuid import UUID

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.config import settings
from app.services.avatar_service import AvatarService


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 12
USER_ID = UUID("0f2d4e8f-4ddc-4e17-9a18-5efb515c3376")


class FakeResponse:
    def __init__(self, status_code: int, text: str = "") -> None:
        self.status_code = status_code
        self.text = text


class FakeClient:
    def __init__(self, response: FakeResponse) -> None:
        self.response = response
        self.posts = []
        self.puts = []
        self.deletes = []

    async def post(self, url: str, *, content: bytes, headers: dict[str, str]) -> FakeResponse:
        self.posts.append({"url": url, "content": content, "headers": headers})
        return self.response

    async def put(self, url: str, *, content: bytes, headers: dict[str, str]) -> FakeResponse:
        self.puts.append({"url": url, "content": content, "headers": headers})
        return self.response

    async def delete(self, url: str, **kwargs) -> FakeResponse:
        self.deletes.append({"url": url, **kwargs})
        return self.response


def make_upload(content_type: str = "image/png") -> UploadFile:
    return UploadFile(
        filename="avatar.png",
        file=BytesIO(PNG_BYTES),
        headers=Headers({"content-type": content_type}),
    )


@pytest.fixture
def storage_settings(monkeypatch):
    monkeypatch.setattr(settings, "AVATAR_STORAGE_BACKEND", "supabase")
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://abc.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "service-role-key")
    monkeypatch.setattr(settings, "SUPABASE_ANON_KEY", "")
    monkeypatch.setattr(settings, "SUPABASE_AVATAR_BUCKET", "avatars")
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "")
    monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "")
    monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "")
    monkeypatch.setattr(settings, "R2_BUCKET", "criptenv-avatars")
    monkeypatch.setattr(settings, "R2_PUBLIC_URL", "")


@pytest.mark.asyncio
async def test_upload_avatar_uses_project_base_url_and_httpx(storage_settings, monkeypatch):
    """Avatar upload should POST directly to the Storage object endpoint."""
    fake_client = FakeClient(FakeResponse(201, "{}"))
    service = AvatarService()
    monkeypatch.setattr(service, "_get_client", lambda: fake_client)
    monkeypatch.setattr(
        "subprocess.run",
        lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("curl must not be used")),
    )

    public_url = await service.upload_avatar(USER_ID, make_upload())

    assert public_url == (
        "https://abc.supabase.co/storage/v1/object/public/"
        "avatars/0f2d4e8f-4ddc-4e17-9a18-5efb515c3376.png"
    )
    assert fake_client.posts[0]["url"] == (
        "https://abc.supabase.co/storage/v1/object/"
        "avatars/0f2d4e8f-4ddc-4e17-9a18-5efb515c3376.png"
    )
    assert fake_client.posts[0]["content"] == PNG_BYTES


@pytest.mark.asyncio
async def test_upload_avatar_rejects_supabase_url_with_rest_path(storage_settings, monkeypatch):
    """SUPABASE_URL must be the project base URL, not a REST API URL."""
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://abc.supabase.co/rest/v1")

    with pytest.raises(HTTPException) as exc_info:
        await AvatarService().upload_avatar(USER_ID, make_upload())

    assert exc_info.value.status_code == 503
    assert "SUPABASE_URL must be the project base URL" in exc_info.value.detail
    assert "/rest/v1" in exc_info.value.detail


@pytest.mark.asyncio
async def test_upload_avatar_does_not_require_anon_key(storage_settings, monkeypatch):
    """Server-side uploads should authenticate with the service role key only."""
    fake_client = FakeClient(FakeResponse(201, "{}"))
    service = AvatarService()
    monkeypatch.setattr(service, "_get_client", lambda: fake_client)

    await service.upload_avatar(USER_ID, make_upload())

    headers = fake_client.posts[0]["headers"]
    assert headers["Authorization"] == "Bearer service-role-key"
    assert headers["apikey"] == "service-role-key"
    assert headers["x-upsert"] == "true"


@pytest.mark.asyncio
async def test_upload_avatar_storage_path_error_is_bad_gateway(storage_settings, monkeypatch):
    """Storage path errors should not be reported as missing buckets."""
    body = '{"code":"PGRST125","message":"Invalid path specified in request URL"}'
    fake_client = FakeClient(FakeResponse(404, body))
    service = AvatarService()
    monkeypatch.setattr(service, "_get_client", lambda: fake_client)

    with pytest.raises(HTTPException) as exc_info:
        await service.upload_avatar(USER_ID, make_upload())

    assert exc_info.value.status_code == 502
    assert "Supabase Storage upload failed" in exc_info.value.detail
    assert "Invalid path specified" in exc_info.value.detail
    assert "bucket" not in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_upload_avatar_to_r2_uses_s3_endpoint_and_public_url(storage_settings, monkeypatch):
    """R2 uploads should use the S3-compatible endpoint and public URL."""
    monkeypatch.setattr(settings, "AVATAR_STORAGE_BACKEND", "r2")
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "account123")
    monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "access-key")
    monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "secret-key")
    monkeypatch.setattr(settings, "R2_BUCKET", "criptenv-avatars")
    monkeypatch.setattr(settings, "R2_PUBLIC_URL", "https://avatars.example.com")

    fake_client = FakeClient(FakeResponse(200, ""))
    service = AvatarService()
    monkeypatch.setattr(service, "_get_client", lambda: fake_client)

    public_url = await service.upload_avatar(USER_ID, make_upload())

    assert public_url == "https://avatars.example.com/0f2d4e8f-4ddc-4e17-9a18-5efb515c3376.png"
    assert fake_client.puts[0]["url"] == (
        "https://account123.r2.cloudflarestorage.com/"
        "criptenv-avatars/0f2d4e8f-4ddc-4e17-9a18-5efb515c3376.png"
    )
    headers = fake_client.puts[0]["headers"]
    assert headers["content-type"] == "image/png"
    assert headers["x-amz-content-sha256"]
    assert headers["x-amz-date"]
    assert headers["Authorization"].startswith("AWS4-HMAC-SHA256 Credential=access-key/")


@pytest.mark.asyncio
async def test_upload_avatar_to_r2_requires_public_url(storage_settings, monkeypatch):
    """R2 backend should fail clearly when public URL is missing."""
    monkeypatch.setattr(settings, "AVATAR_STORAGE_BACKEND", "r2")
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "account123")
    monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "access-key")
    monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "secret-key")
    monkeypatch.setattr(settings, "R2_BUCKET", "criptenv-avatars")
    monkeypatch.setattr(settings, "R2_PUBLIC_URL", "")

    with pytest.raises(HTTPException) as exc_info:
        await AvatarService().upload_avatar(USER_ID, make_upload())

    assert exc_info.value.status_code == 503
    assert "R2_PUBLIC_URL" in exc_info.value.detail


@pytest.mark.asyncio
async def test_delete_avatar_from_r2_deletes_known_extensions(storage_settings, monkeypatch):
    """R2 deletion should try all avatar extensions and remain non-fatal."""
    monkeypatch.setattr(settings, "AVATAR_STORAGE_BACKEND", "r2")
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "account123")
    monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "access-key")
    monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "secret-key")
    monkeypatch.setattr(settings, "R2_BUCKET", "criptenv-avatars")
    monkeypatch.setattr(settings, "R2_PUBLIC_URL", "https://avatars.example.com")

    fake_client = FakeClient(FakeResponse(204, ""))
    service = AvatarService()
    monkeypatch.setattr(service, "_get_client", lambda: fake_client)

    await service.delete_avatar(USER_ID)

    assert [item["url"].rsplit("/", 1)[-1] for item in fake_client.deletes] == [
        "0f2d4e8f-4ddc-4e17-9a18-5efb515c3376.png",
        "0f2d4e8f-4ddc-4e17-9a18-5efb515c3376.jpg",
        "0f2d4e8f-4ddc-4e17-9a18-5efb515c3376.jpeg",
    ]
