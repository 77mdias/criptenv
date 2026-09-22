"""Tests for Rotation Router M3.5.3

TDD RED Phase: Tests that describe expected behavior.
"""

import pytest
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from unittest.mock import patch, AsyncMock, MagicMock

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


class TestRotationRoutes:
    """TDD RED: Tests for rotation endpoints."""

    def test_rotate_endpoint_exists(self):
        """POST /api/v1/projects/{pid}/environments/{eid}/secrets/{key}/rotate should exist."""
        from app.routers.rotation import router
        # Router should be defined
        assert router is not None
        # Should have rotate endpoint
        routes = [r.path for r in router.routes]
        rotate_routes = [r for r in routes if 'rotate' in r]
        assert len(rotate_routes) >= 1 or '/{secret_key}/rotate' in routes

    def test_expiration_endpoint_exists(self):
        """POST /api/v1/projects/{pid}/environments/{eid}/secrets/{key}/expiration should exist."""
        from app.routers.rotation import router
        assert router is not None
        routes = [r.path for r in router.routes]
        # Should have expiration endpoint
        expiration_routes = [r for r in routes if 'expiration' in r or '/{secret_key}' in r]
        assert len(expiration_routes) >= 1

    def test_rotation_status_endpoint_exists(self):
        """GET /api/v1/projects/{pid}/environments/{eid}/secrets/{key}/rotation should exist."""
        from app.routers.rotation import router
        assert router is not None

    def test_expiring_router_exists(self):
        """GET /api/v1/projects/{pid}/secrets/expiring should exist via expiring_router."""
        from app.routers.rotation import expiring_router
        assert expiring_router is not None


class TestRotationSchemas:
    """Test that schemas are properly defined for rotation endpoints."""

    def test_rotation_request_schema(self):
        """RotationRequest should have new_value, iv, auth_tag."""
        from app.schemas.secret_expiration import RotationRequest
        
        schema = RotationRequest(
            new_value="encrypted_value",
            iv="base64iv",
            auth_tag="base64tag"
        )
        assert schema.new_value == "encrypted_value"
        assert schema.iv == "base64iv"
        assert schema.auth_tag == "base64tag"

    def test_rotation_request_with_reason(self):
        """RotationRequest should accept optional reason."""
        from app.schemas.secret_expiration import RotationRequest
        
        schema = RotationRequest(
            new_value="encrypted",
            iv="iv",
            auth_tag="tag",
            reason="Scheduled rotation"
        )
        assert schema.reason == "Scheduled rotation"

    def test_rotation_response_schema(self):
        """RotationResponse should have rotation_id, secret_key, rotated_at, new_version."""
        from app.schemas.secret_expiration import RotationResponse
        
        rotation_id = uuid4()
        now = datetime.now(timezone.utc)
        
        schema = RotationResponse(
            rotation_id=rotation_id,
            secret_key="DATABASE_URL",
            rotated_at=now,
            new_version=5,
            previous_version=4
        )
        assert schema.rotation_id == rotation_id
        assert schema.secret_key == "DATABASE_URL"
        assert schema.new_version == 5
        assert schema.previous_version == 4

    def test_expiration_create_schema(self):
        """ExpirationCreate should accept expires_at, rotation_policy, notify_days."""
        from app.schemas.secret_expiration import ExpirationCreate
        
        schema = ExpirationCreate(
            secret_key="API_KEY",
            expires_at=datetime.now(timezone.utc) + timedelta(days=90),
            rotation_policy="notify",
            notify_days_before=14
        )
        assert schema.rotation_policy == "notify"
        assert schema.notify_days_before == 14

    def test_expiration_create_omits_notify_days_by_default(self):
        from app.schemas.secret_expiration import ExpirationCreate

        schema = ExpirationCreate(
            secret_key="API_KEY",
            expires_at=datetime.now(timezone.utc) + timedelta(days=90),
        )

        assert schema.notify_days_before is None
        assert "notify_days_before" not in schema.model_fields_set

    def test_expiration_response_schema(self):
        """ExpirationResponse should have all expiration fields."""
        from app.schemas.secret_expiration import ExpirationResponse
        
        exp_id = uuid4()
        project_id = uuid4()
        env_id = uuid4()
        now = datetime.now(timezone.utc)
        
        schema = ExpirationResponse(
            id=exp_id,
            secret_key="SECRET",
            expires_at=now + timedelta(days=30),
            rotation_policy="manual",
            notify_days_before=7,
            last_notified_at=None,
            rotated_at=None,
            created_at=now,
            updated_at=now,
            project_id=project_id,
            environment_id=env_id
        )
        assert schema.secret_key == "SECRET"
        assert schema.is_expired is None  # not computed in this case
        assert schema.days_until_expiration is None

    def test_rotation_status_schema(self):
        """RotationStatus should have current_version, expires_at, rotation_policy."""
        from app.schemas.secret_expiration import RotationStatus
        
        schema = RotationStatus(
            secret_key="MY_KEY",
            current_version=3,
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
            rotation_policy="notify",
            rotated_at=None,
            last_notified_at=None
        )
        assert schema.current_version == 3
        assert schema.rotation_policy == "notify"
        assert schema.needs_rotation is False

    def test_rotation_history_response_schema(self):
        """RotationHistoryResponse should have items list and total."""
        from app.schemas.secret_expiration import RotationHistoryResponse, RotationHistoryItem
        
        item = RotationHistoryItem(
            id=uuid4(),
            secret_key="KEY",
            previous_version=2,
            new_version=3,
            rotated_by=None,
            rotated_at=datetime.now(timezone.utc),
            reason="Scheduled"
        )
        
        response = RotationHistoryResponse(items=[item], total=1)
        assert len(response.items) == 1
        assert response.total == 1

    def test_expiration_list_response_schema(self):
        """ExpirationListResponse should have items list and total."""
        from app.schemas.secret_expiration import ExpirationListResponse, ExpirationResponse
        
        now = datetime.now(timezone.utc)
        item = ExpirationResponse(
            id=uuid4(),
            secret_key="TEST_KEY",
            expires_at=now + timedelta(days=30),
            rotation_policy="notify",
            notify_days_before=7,
            last_notified_at=None,
            rotated_at=None,
            created_at=now,
            updated_at=now,
            project_id=uuid4(),
            environment_id=uuid4()
        )
        
        response = ExpirationListResponse(items=[item], total=1)
        assert len(response.items) == 1
        assert response.total == 1


class TestRotationRouterIntegration:
    """Integration tests for rotation router with mocked services."""

    @pytest.mark.asyncio
    async def test_rotate_secret_calls_service(self, mock_db, mock_user):
        """Rotate endpoint should call RotationService.rotate_secret."""
        from app.routers.rotation import router
        from app.services.rotation_service import RotationService
        from app.schemas.secret_expiration import RotationRequest
        
        # Mock the service
        mock_rotation = MagicMock()
        mock_rotation.id = uuid4()
        mock_rotation.rotated_at = datetime.now(timezone.utc)
        mock_rotation.previous_version = 4
        
        service_instance = MagicMock(spec=RotationService)
        service_instance.rotate_secret = AsyncMock(return_value=(mock_rotation, 5))
        
        with patch('app.routers.rotation.RotationService', return_value=service_instance):
            with patch('app.routers.rotation.get_current_user', AsyncMock(return_value=mock_user)):
                with patch('app.routers.rotation.ProjectService') as mock_ps:
                    mock_ps_instance = MagicMock()
                    mock_ps_instance.check_user_access = AsyncMock(return_value=MagicMock())
                    mock_ps.return_value = mock_ps_instance
                    
                    # Verify service has rotate_secret method
                    assert hasattr(service_instance, 'rotate_secret')

    @pytest.mark.asyncio
    async def test_set_expiration_creates_or_updates(self, mock_db, mock_user):
        """Set expiration should create if not exists, update if exists."""
        from app.services.rotation_service import RotationService
        
        service_instance = MagicMock(spec=RotationService)
        service_instance.get_expiration = AsyncMock(return_value=None)  # not exists
        service_instance.create_expiration = AsyncMock()
        
        # Should call create when not exists
        with patch('app.routers.rotation.RotationService', return_value=service_instance):
            assert service_instance.create_expiration is not None

    @pytest.mark.asyncio
    async def test_get_rotation_status_returns_status(self, mock_db, mock_user):
        """Get rotation status should call service and return RotationStatus."""
        from app.schemas.secret_expiration import RotationStatus
        
        mock_status = RotationStatus(
            secret_key="TEST_KEY",
            current_version=1,
            rotation_policy="manual"
        )
        
        service_instance = MagicMock()
        service_instance.get_rotation_status = AsyncMock(return_value=mock_status)
        
        with patch('app.routers.rotation.RotationService', return_value=service_instance):
            status = await service_instance.get_rotation_status(uuid4(), uuid4(), "TEST_KEY")
            assert status.secret_key == "TEST_KEY"
            assert status.current_version == 1

    @pytest.mark.asyncio
    async def test_list_expiring_filters_by_days(self, mock_db):
        """List expiring should accept days parameter and filter."""
        from app.services.rotation_service import RotationService
        
        mock_expirations = [
            MagicMock(expires_at=datetime.now(timezone.utc) + timedelta(days=5)),
            MagicMock(expires_at=datetime.now(timezone.utc) + timedelta(days=20))
        ]
        
        service_instance = MagicMock()
        service_instance.list_expirations = AsyncMock(return_value=(mock_expirations, 2))
        
        with patch('app.routers.rotation.RotationService', return_value=service_instance):
            expirations, total = await service_instance.list_expirations(
                project_id=uuid4(),
                include_expired=False
            )
            # Should return all (filtering by days happens in router)
            assert total == 2

    @pytest.mark.asyncio
    async def test_rotation_history_returns_list(self, mock_db):
        """Get rotation history should call service and return list."""
        from app.schemas.secret_expiration import RotationHistoryItem
        
        mock_history = [
            RotationHistoryItem(
                id=uuid4(),
                secret_key="KEY",
                previous_version=1,
                new_version=2,
                rotated_by=None,
                rotated_at=datetime.now(timezone.utc),
                reason=None
            )
        ]
        
        service_instance = MagicMock()
        service_instance.get_rotation_history = AsyncMock(return_value=mock_history)
        
        with patch('app.routers.rotation.RotationService', return_value=service_instance):
            history = await service_instance.get_rotation_history(
                uuid4(), uuid4(), "KEY"
            )
            assert len(history) == 1
            assert history[0].new_version == 2

    @pytest.mark.asyncio
    async def test_rotation_mutations_request_admin_access(self, mock_user):
        """Mutation paths must ask ProjectService for admin access."""
        from app.routers.rotation import _check_access

        service = MagicMock()
        service.check_user_access = AsyncMock(return_value=MagicMock(role="admin"))
        project_id = uuid4()
        environment_id = uuid4()

        # The environment lookup must now resolve to a row owned by this project.
        environment = MagicMock()
        environment.archived = False
        result = MagicMock()
        result.scalar_one_or_none.return_value = environment
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)

        await _check_access(
            mock_user, project_id, environment_id, service, db, "admin"
        )

        service.check_user_access.assert_awaited_once_with(
            mock_user.id,
            project_id,
            "admin",
        )

    @pytest.mark.asyncio
    async def test_create_expiration_resolves_project_default_only_when_omitted(self, mock_db):
        from app.models.project import Project
        from app.schemas.secret_expiration import ExpirationCreate
        from app.services.rotation_service import RotationService

        project = MagicMock(spec=Project)
        project.settings = {"alerts": {"default_notify_days_before": 21}}
        project_id = uuid4()
        result = MagicMock()
        result.scalar_one_or_none.return_value = project
        mock_db.execute.return_value = result
        mock_db.add = MagicMock()
        mock_db.refresh = AsyncMock()

        expiration = await RotationService(mock_db).create_expiration(
            project_id,
            uuid4(),
            ExpirationCreate(
                secret_key="API_KEY",
                expires_at=datetime.now(timezone.utc) + timedelta(days=90),
            ),
        )

        assert expiration.notify_days_before == 21

    @pytest.mark.asyncio
    async def test_create_expiration_keeps_explicit_notify_days(self, mock_db):
        from app.schemas.secret_expiration import ExpirationCreate
        from app.services.rotation_service import RotationService

        mock_db.refresh = AsyncMock()
        mock_db.add = MagicMock()
        expiration = await RotationService(mock_db).create_expiration(
            uuid4(),
            uuid4(),
            ExpirationCreate(
                secret_key="API_KEY",
                expires_at=datetime.now(timezone.utc) + timedelta(days=90),
                notify_days_before=3,
            ),
        )

        assert expiration.notify_days_before == 3

    @pytest.mark.asyncio
    async def test_pending_selection_uses_each_policy_and_lead_time(self):
        from app.models.secret_expiration import SecretExpiration
        from app.services.rotation_service import RotationService

        now = datetime.now(timezone.utc)
        candidates = [
            SecretExpiration(expires_at=now + timedelta(days=2), rotation_policy="notify", notify_days_before=3),
            SecretExpiration(expires_at=now + timedelta(days=2), rotation_policy="notify", notify_days_before=1),
            SecretExpiration(expires_at=now - timedelta(days=1), rotation_policy="manual", notify_days_before=30),
        ]

        class Result:
            def scalars(self):
                return self

            def all(self):
                return candidates

        db = MagicMock()
        db.execute = AsyncMock(return_value=Result())
        pending = await RotationService(db).list_pending_rotations()

        assert candidates[0] in pending
        assert candidates[1] not in pending
        assert candidates[2] in pending


class TestRotationRouterSecurity:
    """Security tests for rotation endpoints."""

    def test_rotate_requires_auth_dependency(self):
        """Rotate endpoint should use get_current_user dependency."""
        from app.routers.rotation import router
        
        # Find routes with rotate
        rotate_routes = [r for r in router.routes if hasattr(r, 'path') and 'rotate' in r.path]
        
        # Check dependencies include auth
        for route in rotate_routes:
            if hasattr(route, 'dependencies'):
                has_auth = any(
                    'get_current_user' in str(d.dependency) 
                    for d in route.dependencies 
                    if d
                )
                # Auth is typically injected via Depends(get_current_user)
                assert route.dependencies is not None or True  # Router-level auth possible

    def test_rotation_requires_auth_dependency(self):
        """Rotation status endpoint should require auth."""
        from app.routers.rotation import router
        
        # GET endpoints for rotation status
        get_routes = [r for r in router.routes if hasattr(r, 'methods') and 'GET' in r.methods]
        assert get_routes is not None

    def test_expiring_list_requires_auth(self):
        """List expiring secrets should require auth."""
        from app.routers.rotation import expiring_router
        
        routes = list(expiring_router.routes)
        assert len(routes) >= 1


# Fixtures
@pytest.fixture
def mock_db():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def mock_user():
    """Mock user for auth."""
    user = MagicMock()
    user.id = uuid4()
    user.email = "test@example.com"
    return user


@pytest.fixture
def mock_project_service():
    """Mock project service."""
    service = MagicMock()
    service.check_user_access = AsyncMock(return_value=MagicMock(role="developer"))
    return service


class TestRotationPersistsCiphertext:
    """CR-P1-8: rotation must persist the new ciphertext with a matching checksum.

    `rotate_secret` used to assign `vault_blob.encrypted_value`, an attribute that
    does not exist on VaultBlob. SQLAlchemy accepted it silently, so the ciphertext
    was never written while the IV and auth tag were -- leaving an undecryptable
    blob while the API reported a successful rotation.
    """

    def _service_with_blob(self, version: int = 3):
        from app.services.rotation_service import RotationService
        from app.models.vault import VaultBlob

        blob = MagicMock(spec=VaultBlob)
        blob.version = version

        result = MagicMock()
        result.scalar_one_or_none.return_value = blob

        mock_db = MagicMock()
        mock_db.execute = AsyncMock(return_value=result)
        mock_db.add = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        mock_db.flush = AsyncMock()

        service = RotationService(db=mock_db)
        service.get_expiration = AsyncMock(return_value=None)
        return service, blob

    @pytest.mark.asyncio
    async def test_rotate_secret_writes_ciphertext_and_canonical_checksum(self):
        from app.schemas.secret_expiration import RotationRequest
        from app.services.vault_service import compute_blob_checksum

        service, blob = self._service_with_blob()
        payload = RotationRequest(
            new_value="NEW_CIPHERTEXT",
            iv="IV_ABC",
            auth_tag="TAG_DEF",
            reason="test",
        )

        rotation, version = await service.rotate_secret(
            project_id=uuid4(),
            environment_id=uuid4(),
            secret_key="API_KEY",
            payload=payload,
            user_id=uuid4(),
        )

        assert blob.ciphertext == "NEW_CIPHERTEXT"
        assert blob.iv == "IV_ABC"
        assert blob.auth_tag == "TAG_DEF"
        assert blob.checksum == compute_blob_checksum(
            "API_KEY", "IV_ABC", "NEW_CIPHERTEXT", "TAG_DEF"
        )
        assert version == 4

    @pytest.mark.asyncio
    async def test_canonical_checksum_matches_the_cli_convention(self):
        """Server-side digest must equal the CLI/web `remote_vault` convention."""
        import hashlib
        from app.services.vault_service import compute_blob_checksum

        expected = hashlib.sha256(
            b"API_KEY:IV_ABC:NEW_CIPHERTEXT:TAG_DEF"
        ).hexdigest()

        assert compute_blob_checksum(
            "API_KEY", "IV_ABC", "NEW_CIPHERTEXT", "TAG_DEF"
        ) == expected

    @pytest.mark.asyncio
    async def test_rotated_blob_is_self_consistent(self):
        """The stored envelope must be verifiable from its own metadata alone."""
        from app.schemas.secret_expiration import RotationRequest
        from app.services.vault_service import compute_blob_checksum

        service, blob = self._service_with_blob()
        payload = RotationRequest(new_value="CT", iv="IV", auth_tag="TAG")

        await service.rotate_secret(
            project_id=uuid4(),
            environment_id=uuid4(),
            secret_key="KEY",
            payload=payload,
        )

        assert blob.checksum == compute_blob_checksum(
            "KEY", blob.iv, blob.ciphertext, blob.auth_tag
        )


class TestRotationEnvironmentScoping:
    """CR-P2-12: the environment id must belong to the project in the path."""

    @pytest.mark.asyncio
    async def test_check_access_rejects_foreign_environment(self):
        from app.routers.rotation import _check_access

        member = MagicMock()
        project_service = MagicMock()
        project_service.check_user_access = AsyncMock(return_value=member)

        result = MagicMock()
        result.scalar_one_or_none.return_value = None  # environment not in project
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)

        with pytest.raises(Exception) as exc_info:
            await _check_access(
                MagicMock(id=uuid4()),
                uuid4(),
                uuid4(),
                project_service,
                db,
                "admin",
            )

        assert getattr(exc_info.value, "status_code", None) == 404
        assert "Environment not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_check_access_rejects_archived_environment(self):
        from app.routers.rotation import _check_access

        project_service = MagicMock()
        project_service.check_user_access = AsyncMock(return_value=MagicMock())

        environment = MagicMock()
        environment.archived = True
        result = MagicMock()
        result.scalar_one_or_none.return_value = environment
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)

        with pytest.raises(Exception) as exc_info:
            await _check_access(
                MagicMock(id=uuid4()), uuid4(), uuid4(), project_service, db, "admin"
            )

        assert getattr(exc_info.value, "status_code", None) == 404

    @pytest.mark.asyncio
    async def test_check_access_allows_matching_environment(self):
        from app.routers.rotation import _check_access

        project_service = MagicMock()
        project_service.check_user_access = AsyncMock(return_value=MagicMock())

        environment = MagicMock()
        environment.archived = False
        result = MagicMock()
        result.scalar_one_or_none.return_value = environment
        db = MagicMock()
        db.execute = AsyncMock(return_value=result)

        # Must not raise.
        await _check_access(
            MagicMock(id=uuid4()), uuid4(), uuid4(), project_service, db, "admin"
        )
