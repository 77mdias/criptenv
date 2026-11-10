"""Contract tests for integration providers.

Each provider runs against httpx.MockTransport and the tests assert the exact
method, path, query and body that the provider's published OpenAPI contract
expects (Vercel: openapi.vercel.sh, Render: api-docs.render.com,
Cloudflare: cloudflare/api-schemas). The previous tests only checked return
types, which let wrong endpoints ship.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import httpx
import pytest

from app.config import settings
from app.crypto.integration_config import IntegrationConfigEncryption
from app.models.oauth_account import OAuthAccount  # noqa: F401  (mapper registry)
from app.strategies.integrations.base import ProviderError
from app.strategies.integrations.cloudflare import CloudflareWorkersProvider
from app.strategies.integrations.render import RenderProvider
from app.strategies.integrations.vercel import VercelProvider


@pytest.fixture
def http(monkeypatch):
    """Route every httpx.AsyncClient through a mock transport.

    Returns (calls, routes): ``routes[(METHOD, path)]`` is an httpx.Response or
    a callable(request) -> Response; every request is recorded in ``calls``.
    """
    calls: list[httpx.Request] = []
    routes: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        route = routes.get((request.method, request.url.path))
        if route is None:
            return httpx.Response(404, json={"error": {"message": f"no route {request.method} {request.url.path}"}})
        return route(request) if callable(route) else route

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    return calls, routes


VERCEL = {"api_token": "vercel-token-123", "project_id": "prj_1", "team_id": "team_1"}
RENDER = {"api_token": "render-token-123", "service_id": "srv_1"}
CLOUDFLARE = {"api_token": "cf-token-12345", "account_id": "acc_1", "script_name": "my-worker"}
SECRETS = [{"key": "DATABASE_URL", "value": "postgres://x"}, {"key": "API_KEY", "value": "sk_1"}]


class TestVercelContract:
    @pytest.mark.asyncio
    async def test_push_upserts_all_secrets_in_one_request(self, http):
        calls, routes = http
        routes[("POST", "/v10/projects/prj_1/env")] = httpx.Response(201, json={"created": [], "failed": []})

        assert await VercelProvider().push_secrets(SECRETS, VERCEL, "preview") is True

        assert len(calls) == 1
        request = calls[0]
        assert request.url.params["upsert"] == "true"
        assert request.url.params["teamId"] == "team_1"
        assert request.headers["Authorization"] == "Bearer vercel-token-123"
        assert json.loads(request.content) == [
            {"key": "DATABASE_URL", "value": "postgres://x", "type": "encrypted", "target": ["preview"]},
            {"key": "API_KEY", "value": "sk_1", "type": "encrypted", "target": ["preview"]},
        ]

    @pytest.mark.asyncio
    async def test_push_without_kind_keeps_todays_payload_and_lists_nothing(self, http):
        calls, routes = http
        routes[("POST", "/v10/projects/prj_1/env")] = httpx.Response(201, json={"created": [], "failed": []})

        provider = VercelProvider()
        await provider.push_secrets(SECRETS, VERCEL, "production")

        assert [(c.method, c.url.path) for c in calls] == [("POST", "/v10/projects/prj_1/env")]
        assert provider.recreated_keys == ()

    @pytest.mark.asyncio
    async def test_push_sends_type_and_visibility_per_kind(self, http):
        calls, routes = http
        routes[("GET", "/v10/projects/prj_1/env")] = httpx.Response(200, json={"envs": []})
        routes[("POST", "/v10/projects/prj_1/env")] = httpx.Response(201, json={"created": [], "failed": []})

        await VercelProvider().push_secrets(
            [{"key": "A", "value": "1", "kind": "secret"}, {"key": "B", "value": "2", "kind": "config"}],
            VERCEL,
            "development",
        )

        assert json.loads(calls[-1].content) == [
            {"key": "A", "value": "1", "type": "sensitive", "visibility": "secret", "target": ["development"]},
            {"key": "B", "value": "2", "type": "encrypted", "visibility": "config", "target": ["development"]},
        ]

    @staticmethod
    def _mismatch_routes(routes, envs, *, patch=None, delete=None, post=None):
        routes[("GET", "/v10/projects/prj_1/env")] = httpx.Response(200, json={"envs": envs})
        routes[("POST", "/v10/projects/prj_1/env")] = post or httpx.Response(201, json={"created": [], "failed": []})
        for env in envs:
            path = f"/v9/projects/prj_1/env/{env['id']}"
            routes[("PATCH", path)] = patch or httpx.Response(200, json={})
            routes[("DELETE", path)] = delete or httpx.Response(200, json={})

    @staticmethod
    def _mutations(calls):
        return [(c.method, c.url.path) for c in calls if c.method in ("PATCH", "DELETE", "POST")]

    @pytest.mark.asyncio
    async def test_config_over_single_target_secret_deletes_then_creates(self, http):
        calls, routes = http
        self._mismatch_routes(routes, [{"id": "env_1", "key": "B", "type": "sensitive", "target": ["production"]}])

        provider = VercelProvider()
        await provider.push_secrets([{"key": "B", "value": "2", "kind": "config"}], VERCEL, "production")

        assert [(c.method, c.url.path) for c in calls] == [
            ("GET", "/v10/projects/prj_1/env"),
            ("DELETE", "/v9/projects/prj_1/env/env_1"),
            ("POST", "/v10/projects/prj_1/env"),
        ]
        assert provider.recreated_keys == ("B",)

    @pytest.mark.asyncio
    async def test_secret_over_single_target_config_deletes_then_creates(self, http):
        calls, routes = http
        self._mismatch_routes(routes, [{"id": "env_1", "key": "B", "type": "encrypted", "target": ["production"]}])

        provider = VercelProvider()
        await provider.push_secrets([{"key": "B", "value": "2", "kind": "secret"}], VERCEL, "production")

        assert self._mutations(calls) == [
            ("DELETE", "/v9/projects/prj_1/env/env_1"),
            ("POST", "/v10/projects/prj_1/env"),
        ]
        assert provider.recreated_keys == ("B",)

    @pytest.mark.asyncio
    async def test_mismatch_on_multi_target_record_patches_out_only_this_target(self, http):
        calls, routes = http
        self._mismatch_routes(
            routes, [{"id": "env_1", "key": "B", "type": "sensitive", "target": ["production", "preview"]}]
        )

        await VercelProvider().push_secrets([{"key": "B", "value": "2", "kind": "config"}], VERCEL, "production")

        assert self._mutations(calls) == [
            ("PATCH", "/v9/projects/prj_1/env/env_1"),
            ("POST", "/v10/projects/prj_1/env"),
        ]
        patch_call = next(c for c in calls if c.method == "PATCH")
        assert json.loads(patch_call.content) == {"target": ["preview"]}

    @pytest.mark.asyncio
    async def test_matching_kind_does_not_touch_record(self, http):
        calls, routes = http
        self._mismatch_routes(routes, [{"id": "env_1", "key": "B", "type": "sensitive", "target": ["production"]}])

        provider = VercelProvider()
        await provider.push_secrets([{"key": "B", "value": "2", "kind": "secret"}], VERCEL, "production")

        assert self._mutations(calls) == [("POST", "/v10/projects/prj_1/env")]
        assert provider.recreated_keys == ()

    @pytest.mark.asyncio
    async def test_record_with_git_branch_is_ignored(self, http):
        calls, routes = http
        self._mismatch_routes(
            routes,
            [{"id": "env_1", "key": "B", "type": "sensitive", "target": ["production"], "gitBranch": "feat"}],
        )

        await VercelProvider().push_secrets([{"key": "B", "value": "2", "kind": "config"}], VERCEL, "production")

        assert self._mutations(calls) == [("POST", "/v10/projects/prj_1/env")]

    @pytest.mark.asyncio
    async def test_record_target_as_string(self, http):
        calls, routes = http
        self._mismatch_routes(routes, [{"id": "env_1", "key": "B", "type": "sensitive", "target": "production"}])

        await VercelProvider().push_secrets([{"key": "B", "value": "2", "kind": "config"}], VERCEL, "production")

        assert self._mutations(calls) == [
            ("DELETE", "/v9/projects/prj_1/env/env_1"),
            ("POST", "/v10/projects/prj_1/env"),
        ]

    @pytest.mark.asyncio
    async def test_other_target_record_untouched(self, http):
        calls, routes = http
        self._mismatch_routes(
            routes,
            [
                {"id": "env_1", "key": "B", "type": "sensitive", "target": ["preview"]},
                {"id": "env_2", "key": "B", "type": "encrypted", "target": ["production"]},
            ],
        )

        await VercelProvider().push_secrets([{"key": "B", "value": "2", "kind": "config"}], VERCEL, "production")

        assert self._mutations(calls) == [("POST", "/v10/projects/prj_1/env")]

    @pytest.mark.asyncio
    async def test_refused_conversion_leaves_that_key_alone_and_syncs_the_rest(self, http):
        calls, routes = http
        self._mismatch_routes(
            routes,
            [
                {"id": "env_b", "key": "B", "type": "sensitive", "target": ["production", "preview"]},
                {"id": "env_c", "key": "C", "type": "sensitive", "target": ["production", "development"]},
            ],
        )
        routes[("PATCH", "/v9/projects/prj_1/env/env_c")] = httpx.Response(
            403, json={"error": {"message": "team policy"}}
        )

        with pytest.raises(ProviderError) as excinfo:
            await VercelProvider().push_secrets(
                [{"key": "B", "value": "2", "kind": "config"}, {"key": "C", "value": "3", "kind": "config"}],
                VERCEL,
                "production",
            )

        message = str(excinfo.value)
        assert "C" in message and "team policy" in message
        assert "not recreated" not in message
        # B was detached and is created again; C was not touched and is not sent.
        post = next(c for c in calls if c.method == "POST")
        assert [item["key"] for item in json.loads(post.content)] == ["B"]

    @pytest.mark.asyncio
    async def test_refused_delete_leaves_that_key_alone(self, http):
        calls, routes = http
        self._mismatch_routes(
            routes,
            [{"id": "env_c", "key": "C", "type": "sensitive", "target": ["production"]}],
            delete=httpx.Response(403, json={"error": {"message": "locked"}}),
        )

        with pytest.raises(ProviderError, match="locked"):
            await VercelProvider().push_secrets(
                [{"key": "A", "value": "1", "kind": "config"}, {"key": "C", "value": "3", "kind": "config"}],
                VERCEL,
                "production",
            )

        post = next(c for c in calls if c.method == "POST")
        assert [item["key"] for item in json.loads(post.content)] == ["A"]

    @pytest.mark.asyncio
    async def test_transport_error_after_removal_names_missing_keys(self, http):
        _, routes = http

        def timeout(request):
            raise httpx.ReadTimeout("")

        self._mismatch_routes(
            routes,
            [{"id": "env_c", "key": "C", "type": "sensitive", "target": ["production"]}],
            post=timeout,
        )

        with pytest.raises(ProviderError, match="Removed from Vercel production and not recreated: C"):
            await VercelProvider().push_secrets([{"key": "C", "value": "3", "kind": "config"}], VERCEL, "production")

    @pytest.mark.asyncio
    async def test_transport_error_during_removal_names_the_key_in_flight(self, http):
        _, routes = http

        def timeout(request):
            raise httpx.ReadTimeout("")

        self._mismatch_routes(
            routes,
            [{"id": "env_c", "key": "C", "type": "sensitive", "target": ["production"]}],
            delete=timeout,
        )

        with pytest.raises(ProviderError, match="not recreated: C"):
            await VercelProvider().push_secrets([{"key": "C", "value": "3", "kind": "config"}], VERCEL, "production")

    @pytest.mark.asyncio
    async def test_create_failure_after_removal_names_missing_keys(self, http):
        _, routes = http
        self._mismatch_routes(
            routes,
            [{"id": "env_c", "key": "C", "type": "sensitive", "target": ["production"]}],
            post=httpx.Response(201, json={"created": [], "failed": [{"error": {"envVarKey": "C", "message": "bad"}}]}),
        )

        with pytest.raises(ProviderError, match="Removed from Vercel production and not recreated: C"):
            await VercelProvider().push_secrets([{"key": "C", "value": "3", "kind": "config"}], VERCEL, "production")

    @pytest.mark.asyncio
    async def test_create_http_error_after_removal_names_missing_keys(self, http):
        _, routes = http
        self._mismatch_routes(
            routes,
            [{"id": "env_c", "key": "C", "type": "sensitive", "target": ["production"]}],
            post=httpx.Response(500, json={"error": {"message": "down"}}),
        )

        with pytest.raises(ProviderError, match="Removed from Vercel production and not recreated: C"):
            await VercelProvider().push_secrets([{"key": "C", "value": "3", "kind": "config"}], VERCEL, "production")

    @pytest.mark.asyncio
    async def test_push_without_team_sends_no_team_param(self, http):
        calls, routes = http
        routes[("POST", "/v10/projects/prj_1/env")] = httpx.Response(201, json={"created": [], "failed": []})

        await VercelProvider().push_secrets(SECRETS, {"api_token": "t" * 10, "project_id": "prj_1"}, "production")

        assert "teamId" not in calls[0].url.params

    @pytest.mark.asyncio
    async def test_push_reports_rejected_variables(self, http):
        _, routes = http
        routes[("POST", "/v10/projects/prj_1/env")] = httpx.Response(
            201,
            json={"created": [], "failed": [{"error": {"envVarKey": "API_KEY", "message": "Value too long"}}]},
        )

        with pytest.raises(ProviderError, match="API_KEY: Value too long"):
            await VercelProvider().push_secrets(SECRETS, VERCEL, "production")

    @pytest.mark.asyncio
    async def test_push_surfaces_vercel_error_message(self, http):
        _, routes = http
        routes[("POST", "/v10/projects/prj_1/env")] = httpx.Response(
            403, json={"error": {"code": "forbidden", "message": "Not authorized"}}
        )

        with pytest.raises(ProviderError, match="Vercel API returned 403: Not authorized"):
            await VercelProvider().push_secrets(SECRETS, VERCEL, "production")

    @pytest.mark.asyncio
    async def test_push_rejects_unknown_target_without_calling_vercel(self, http):
        calls, _ = http

        with pytest.raises(ProviderError, match="production, preview, development"):
            await VercelProvider().push_secrets(SECRETS, VERCEL, "staging")
        assert calls == []

    @pytest.mark.asyncio
    async def test_pull_filters_target_and_decrypts_encrypted_values(self, http):
        calls, routes = http
        routes[("GET", "/v10/projects/prj_1/env")] = httpx.Response(200, json={"envs": [
            {"id": "e1", "key": "PLAIN", "value": "p", "type": "plain", "target": ["production"]},
            {"id": "e2", "key": "SECRET", "value": "ciphertext", "type": "encrypted", "decrypted": False,
             "target": ["production", "preview"]},
            {"id": "e3", "key": "PREVIEW_ONLY", "value": "x", "type": "plain", "target": ["preview"]},
            {"id": "e4", "key": "LOCKED", "type": "sensitive", "target": ["production"]},
            {"id": "e5", "key": "BRANCH", "value": "b", "type": "plain", "target": ["production"], "gitBranch": "feat"},
        ]})
        routes[("GET", "/v1/projects/prj_1/env/e2")] = httpx.Response(200, json={"key": "SECRET", "value": "s"})

        secrets = await VercelProvider().pull_secrets(VERCEL, "production")

        assert secrets == [{"key": "PLAIN", "value": "p"}, {"key": "SECRET", "value": "s"}]
        assert all(call.url.params["teamId"] == "team_1" for call in calls)
        assert [call.url.path for call in calls] == ["/v10/projects/prj_1/env", "/v1/projects/prj_1/env/e2"]

    @pytest.mark.asyncio
    async def test_pull_follows_pagination_until_next_is_null(self, http):
        calls, routes = http
        pages = {
            None: {"envs": [{"id": "e1", "key": "A", "value": "1", "type": "plain", "target": ["production"]}],
                   "pagination": {"count": 1, "next": 1700000000000, "prev": None}},
            "1700000000000": {"envs": [{"id": "e2", "key": "B", "value": "2", "type": "plain", "target": ["production"]}],
                              "pagination": {"count": 1, "next": None, "prev": 1700000000001}},
        }
        routes[("GET", "/v10/projects/prj_1/env")] = lambda request: httpx.Response(
            200, json=pages[request.url.params.get("until")]
        )

        secrets = await VercelProvider().pull_secrets(VERCEL, "production")

        assert secrets == [{"key": "A", "value": "1"}, {"key": "B", "value": "2"}]
        assert calls[1].url.params["until"] == "1700000000000"
        assert calls[1].url.params["teamId"] == "team_1"

    @pytest.mark.asyncio
    async def test_pull_aborts_when_vercel_repeats_a_page(self, http):
        _, routes = http
        routes[("GET", "/v10/projects/prj_1/env")] = httpx.Response(200, json={
            "envs": [], "pagination": {"count": 0, "next": 1700000000000, "prev": None},
        })

        with pytest.raises(ProviderError, match="partial result"):
            await VercelProvider().pull_secrets(VERCEL, "production")

    @pytest.mark.asyncio
    async def test_validate_fetches_the_configured_project(self, http):
        calls, routes = http
        routes[("GET", "/v9/projects/prj_1")] = httpx.Response(200, json={"id": "prj_1"})

        assert await VercelProvider().validate_connection(VERCEL) is True
        assert calls[0].url.params["teamId"] == "team_1"

    @pytest.mark.asyncio
    async def test_validate_raises_with_reason_on_missing_project(self, http):
        _, routes = http
        routes[("GET", "/v9/projects/prj_1")] = httpx.Response(404, json={"error": {"message": "Project not found"}})

        with pytest.raises(ProviderError, match="404: Project not found"):
            await VercelProvider().validate_connection(VERCEL)


class TestRenderContract:
    @pytest.mark.asyncio
    async def test_push_puts_each_key_without_replacing_the_collection(self, http):
        calls, routes = http
        for secret in SECRETS:
            routes[("PUT", f"/v1/services/srv_1/env-vars/{secret['key']}")] = httpx.Response(
                200, json={"key": secret["key"], "value": secret["value"]}
            )

        assert await RenderProvider().push_secrets(SECRETS, RENDER, "production") is True

        assert [(c.method, c.url.path) for c in calls] == [
            ("PUT", "/v1/services/srv_1/env-vars/DATABASE_URL"),
            ("PUT", "/v1/services/srv_1/env-vars/API_KEY"),
        ]
        assert json.loads(calls[0].content) == {"value": "postgres://x"}
        assert calls[0].headers["Authorization"] == "Bearer render-token-123"

    @pytest.mark.asyncio
    async def test_push_stops_on_render_error(self, http):
        _, routes = http
        routes[("PUT", "/v1/services/srv_1/env-vars/DATABASE_URL")] = httpx.Response(
            401, json={"message": "unauthorized"}
        )

        with pytest.raises(ProviderError, match="Render API returned 401: unauthorized"):
            await RenderProvider().push_secrets(SECRETS, RENDER, "production")

    @pytest.mark.asyncio
    async def test_pull_follows_cursor_pagination(self, http):
        calls, routes = http
        first_page = [{"envVar": {"key": f"K{i}", "value": str(i)}, "cursor": f"c{i}"} for i in range(100)]
        last_page = [{"envVar": {"key": "LAST", "value": "z"}, "cursor": "c100"}]
        routes[("GET", "/v1/services/srv_1/env-vars")] = lambda request: httpx.Response(
            200, json=last_page if request.url.params.get("cursor") == "c99" else first_page
        )

        secrets = await RenderProvider().pull_secrets(RENDER, "production")

        assert len(secrets) == 101
        assert secrets[-1] == {"key": "LAST", "value": "z"}
        assert "cursor" not in calls[0].url.params
        assert calls[1].url.params["cursor"] == "c99"

    @pytest.mark.asyncio
    async def test_validate_fetches_the_configured_service(self, http):
        calls, routes = http
        routes[("GET", "/v1/services/srv_1")] = httpx.Response(200, json={"id": "srv_1"})

        assert await RenderProvider().validate_connection(RENDER) is True
        assert calls[0].url.path == "/v1/services/srv_1"


class TestCloudflareContract:
    PATH = "/client/v4/accounts/acc_1/workers/scripts/my-worker/secrets"

    @pytest.mark.asyncio
    async def test_push_patches_all_secrets_in_one_bulk_request(self, http):
        calls, routes = http
        routes[("PATCH", f"{self.PATH}-bulk")] = httpx.Response(200, json={"success": True, "result": {}})

        assert await CloudflareWorkersProvider().push_secrets(SECRETS, CLOUDFLARE, "production") is True

        assert len(calls) == 1
        assert calls[0].headers["Authorization"] == "Bearer cf-token-12345"
        assert json.loads(calls[0].content) == {"secrets": {
            "DATABASE_URL": {"name": "DATABASE_URL", "type": "secret_text", "text": "postgres://x"},
            "API_KEY": {"name": "API_KEY", "type": "secret_text", "text": "sk_1"},
        }}

    @pytest.mark.asyncio
    async def test_push_splits_into_batches_of_100(self, http):
        calls, routes = http
        routes[("PATCH", f"{self.PATH}-bulk")] = httpx.Response(200, json={"success": True, "result": {}})
        secrets = [{"key": f"K{i}", "value": str(i)} for i in range(250)]

        assert await CloudflareWorkersProvider().push_secrets(secrets, CLOUDFLARE, "production") is True

        assert [len(json.loads(call.content)["secrets"]) for call in calls] == [100, 100, 50]

    @pytest.mark.asyncio
    async def test_push_surfaces_cloudflare_error_message(self, http):
        _, routes = http
        routes[("PATCH", f"{self.PATH}-bulk")] = httpx.Response(
            403, json={"success": False, "errors": [{"code": 10000, "message": "Authentication error"}]}
        )

        with pytest.raises(ProviderError, match="Cloudflare API returned 403: Authentication error"):
            await CloudflareWorkersProvider().push_secrets(SECRETS, CLOUDFLARE, "production")

    @pytest.mark.asyncio
    async def test_pull_is_not_supported(self, http):
        calls, _ = http
        assert CloudflareWorkersProvider.supports_pull is False

        with pytest.raises(ProviderError, match="pull is not supported"):
            await CloudflareWorkersProvider().pull_secrets(CLOUDFLARE, "production")
        assert calls == []

    @pytest.mark.asyncio
    async def test_validate_lists_script_secrets(self, http):
        calls, routes = http
        routes[("GET", self.PATH)] = httpx.Response(200, json={"success": True, "result": []})

        assert await CloudflareWorkersProvider().validate_connection(CLOUDFLARE) is True
        assert calls[0].url.path == self.PATH


def _integration(provider: str, config: dict) -> MagicMock:
    integration = MagicMock()
    integration.id = uuid4()
    integration.provider = provider
    integration.status = "active"
    integration.last_error = None
    integration.config = IntegrationConfigEncryption.encrypt(config, settings.INTEGRATION_CONFIG_SECRET)
    return integration


def _service():
    from app.services.integration_service import IntegrationService

    db = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    return IntegrationService(db=db)


class TestIntegrationServiceProviders:
    @pytest.mark.asyncio
    async def test_create_rejects_unregistered_provider(self):
        from app.services.integration_service import IntegrationConfigError

        with pytest.raises(IntegrationConfigError, match="Unsupported provider 'railway'"):
            await _service().create_integration(uuid4(), "railway", "Railway", {"api_token": "x"})

    @pytest.mark.asyncio
    async def test_create_rejects_missing_required_config(self):
        from app.services.integration_service import IntegrationConfigError

        with pytest.raises(IntegrationConfigError, match="script_name"):
            await _service().create_integration(
                uuid4(), "cloudflare", "Worker", {"api_token": "x", "account_id": "a", "script_name": ""}
            )

    @pytest.mark.asyncio
    async def test_create_drops_empty_optional_values(self):
        integration = await _service().create_integration(
            uuid4(), "vercel", "Vercel", {"api_token": "tok", "project_id": "prj", "team_id": None}
        )
        stored = IntegrationConfigEncryption.decrypt_legacy_or_encrypted(
            integration.config, settings.INTEGRATION_CONFIG_SECRET
        )
        assert stored == {"api_token": "tok", "project_id": "prj"}

    @pytest.mark.asyncio
    async def test_pull_returns_provider_secrets(self, http):
        _, routes = http
        routes[("GET", "/v1/services/srv_1/env-vars")] = httpx.Response(
            200, json=[{"envVar": {"key": "A", "value": "1"}, "cursor": "c"}]
        )
        service = _service()
        integration = _integration("render", RENDER)

        with patch.object(service, "get_integration", new=AsyncMock(return_value=integration)):
            success, error, secrets = await service.sync_integration(
                integration.id, project_id=uuid4(), direction="pull", environment="production"
            )

        assert (success, error, secrets) == (True, None, [{"key": "A", "value": "1"}])
        assert integration.last_sync_at is not None

    @pytest.mark.asyncio
    async def test_push_returns_keys_vercel_recreated(self, http):
        _, routes = http
        routes[("GET", "/v10/projects/prj_1/env")] = httpx.Response(
            200, json={"envs": [{"id": "env_1", "key": "B", "type": "sensitive", "target": ["production"]}]}
        )
        routes[("DELETE", "/v9/projects/prj_1/env/env_1")] = httpx.Response(200, json={})
        routes[("POST", "/v10/projects/prj_1/env")] = httpx.Response(201, json={"created": [], "failed": []})
        service = _service()
        integration = _integration("vercel", VERCEL)

        with patch.object(service, "get_integration", new=AsyncMock(return_value=integration)):
            result = await service.sync_integration(
                integration.id,
                project_id=uuid4(),
                direction="push",
                secrets=[{"key": "B", "value": "2", "kind": "config"}],
                environment="production",
            )

        assert result == (True, None, ["B"])

    @pytest.mark.asyncio
    async def test_pull_on_push_only_provider_fails_without_flagging_integration(self, http):
        calls, _ = http
        service = _service()
        integration = _integration("cloudflare", CLOUDFLARE)

        with patch.object(service, "get_integration", new=AsyncMock(return_value=integration)):
            success, error, _ = await service.sync_integration(
                integration.id, project_id=uuid4(), direction="pull"
            )

        assert success is False
        assert "does not support pull" in error
        assert integration.status == "active"
        assert calls == []

    @pytest.mark.asyncio
    async def test_push_failure_persists_redacted_provider_error(self, http):
        _, routes = http
        # A provider echoing the token back must never get it persisted.
        routes[("POST", "/v10/projects/prj_1/env")] = httpx.Response(
            400, json={"error": {"message": "bad token vercel-token-123"}}
        )
        service = _service()
        integration = _integration("vercel", VERCEL)

        with patch.object(service, "get_integration", new=AsyncMock(return_value=integration)):
            success, error, _ = await service.sync_integration(
                integration.id, project_id=uuid4(), direction="push", secrets=SECRETS
            )

        assert success is False
        assert integration.status == "error"
        assert "vercel-token-123" not in integration.last_error
        assert integration.last_error == error == "Vercel API returned 400: bad token [redacted]"

    @pytest.mark.asyncio
    async def test_validate_returns_provider_reason(self, http):
        _, routes = http
        routes[("GET", "/v9/projects/prj_1")] = httpx.Response(403, json={"error": {"message": "Forbidden"}})
        service = _service()
        integration = _integration("vercel", VERCEL)

        with patch.object(service, "get_integration", new=AsyncMock(return_value=integration)):
            valid, error = await service.validate_integration(integration.id, project_id=uuid4())

        assert valid is False
        assert error == "Vercel API returned 403: Forbidden"
        assert integration.last_error == error


    @pytest.mark.asyncio
    async def test_network_error_is_named_not_blank(self, http):
        _, routes = http

        def timeout(request):
            raise httpx.ConnectTimeout("")

        routes[("GET", "/v1/services/srv_1")] = timeout
        service = _service()
        integration = _integration("render", RENDER)

        with patch.object(service, "get_integration", new=AsyncMock(return_value=integration)):
            valid, error = await service.validate_integration(integration.id, project_id=uuid4())

        assert valid is False
        assert error == "Could not reach render: ConnectTimeout"


class TestSyncSchemas:
    def test_sync_secret_kind_is_optional_and_validated(self):
        from pydantic import ValidationError

        from app.routers.integrations import SyncSecret

        assert SyncSecret(key="A", value="1").kind is None
        assert SyncSecret(key="A", value="1", kind="secret").kind == "secret"
        with pytest.raises(ValidationError):
            SyncSecret(key="A", value="1", kind="public")

    def test_sync_response_recreated_defaults_to_none(self):
        from app.routers.integrations import SyncResponse

        assert SyncResponse(success=True).recreated is None
        assert SyncResponse(success=True, recreated=["B"]).recreated == ["B"]

    def test_sync_request_requires_key_and_value(self):
        from pydantic import ValidationError

        from app.routers.integrations import SyncRequest

        with pytest.raises(ValidationError):
            SyncRequest(direction="push", secrets=[{"key": "A"}])

    def test_registry_exposes_cloudflare(self):
        from app.strategies.integrations import list_providers

        assert {"vercel", "render", "cloudflare"} <= set(list_providers())
        assert "railway" not in list_providers()


@pytest.mark.asyncio
class TestDeleteAndDeployContracts:
    """delete_secrets removes only the named keys; trigger_deploy asks the provider for a new deploy."""

    @staticmethod
    def _vercel_envs(routes, envs):
        routes[("GET", "/v10/projects/prj_1/env")] = httpx.Response(200, json={"envs": envs})
        for env in envs:
            routes[("PATCH", f"/v9/projects/prj_1/env/{env['id']}")] = httpx.Response(200, json={})
            routes[("DELETE", f"/v9/projects/prj_1/env/{env['id']}")] = httpx.Response(200, json={})

    @staticmethod
    def _writes(calls):
        return [(c.method, c.url.path) for c in calls if c.method != "GET"]

    async def test_vercel_delete_removes_the_record_of_a_single_target(self, http):
        calls, routes = http
        self._vercel_envs(routes, [
            {"id": "e1", "key": "A", "type": "encrypted", "target": ["production"]},
            {"id": "e2", "key": "B", "type": "encrypted", "target": ["production"]},
        ])

        await VercelProvider().delete_secrets(["A"], VERCEL, "production")

        assert self._writes(calls) == [("DELETE", "/v9/projects/prj_1/env/e1")]
        assert calls[-1].url.params["teamId"] == "team_1"

    async def test_vercel_delete_keeps_the_other_targets_of_a_shared_record(self, http):
        calls, routes = http
        self._vercel_envs(routes, [{"id": "e1", "key": "A", "type": "encrypted", "target": ["production", "preview"]}])

        await VercelProvider().delete_secrets(["A"], VERCEL, "production")

        assert self._writes(calls) == [("PATCH", "/v9/projects/prj_1/env/e1")]
        assert json.loads(calls[-1].content) == {"target": ["preview"]}

    async def test_vercel_delete_leaves_branch_records_and_other_targets_alone(self, http):
        calls, routes = http
        self._vercel_envs(routes, [
            {"id": "e1", "key": "A", "type": "encrypted", "target": ["production"], "gitBranch": "feat"},
            {"id": "e2", "key": "A", "type": "encrypted", "target": ["preview"]},
            {"id": "e3", "key": "B", "type": "encrypted", "target": ["production"]},
        ])

        await VercelProvider().delete_secrets(["A"], VERCEL, "production")

        assert self._writes(calls) == []

    async def test_vercel_delete_reports_a_refusal(self, http):
        calls, routes = http
        self._vercel_envs(routes, [{"id": "e1", "key": "A", "type": "encrypted", "target": ["production"]}])
        routes[("DELETE", "/v9/projects/prj_1/env/e1")] = httpx.Response(403, json={"error": {"message": "nope"}})

        with pytest.raises(ProviderError, match="Vercel API returned 403: nope"):
            await VercelProvider().delete_secrets(["A"], VERCEL, "production")

    async def test_render_delete_calls_the_single_variable_route_per_key(self, http):
        calls, routes = http
        routes[("DELETE", "/v1/services/srv_1/env-vars/A")] = httpx.Response(204)
        routes[("DELETE", "/v1/services/srv_1/env-vars/B%2FC")] = httpx.Response(204)

        await RenderProvider().delete_secrets(["A", "B/C"], RENDER, "production")

        assert [(c.method, c.url.raw_path.decode()) for c in calls] == [
            ("DELETE", "/v1/services/srv_1/env-vars/A"),
            ("DELETE", "/v1/services/srv_1/env-vars/B%2FC"),
        ]
        assert calls[0].headers["Authorization"] == "Bearer render-token-123"

    async def test_cloudflare_delete_calls_the_secret_route_per_key(self, http):
        calls, routes = http
        routes[("DELETE", "/client/v4/accounts/acc_1/workers/scripts/my-worker/secrets/A")] = httpx.Response(
            200, json={"success": True}
        )

        await CloudflareWorkersProvider().delete_secrets(["A"], CLOUDFLARE, "production")

        assert [(c.method, c.url.path) for c in calls] == [
            ("DELETE", "/client/v4/accounts/acc_1/workers/scripts/my-worker/secrets/A")
        ]

    async def test_delete_of_a_key_the_provider_does_not_have_is_not_an_error(self, http):
        calls, routes = http
        routes[("GET", "/v10/projects/prj_1/env")] = httpx.Response(200, json={"envs": []})
        # Render and Cloudflare answer 404 (the fixture's default) for a key that is not there.

        await VercelProvider().delete_secrets(["GONE"], VERCEL, "production")
        await RenderProvider().delete_secrets(["GONE"], RENDER, "production")
        await CloudflareWorkersProvider().delete_secrets(["GONE"], CLOUDFLARE, "production")

        assert self._writes(calls) == [
            ("DELETE", "/v1/services/srv_1/env-vars/GONE"),
            ("DELETE", "/client/v4/accounts/acc_1/workers/scripts/my-worker/secrets/GONE"),
        ]

    async def test_render_and_cloudflare_delete_report_other_errors(self, http):
        calls, routes = http
        routes[("DELETE", "/v1/services/srv_1/env-vars/A")] = httpx.Response(401, json={"message": "bad token"})
        routes[("DELETE", "/client/v4/accounts/acc_1/workers/scripts/my-worker/secrets/A")] = httpx.Response(
            403, json={"errors": [{"message": "forbidden"}]}
        )

        with pytest.raises(ProviderError, match="Render API returned 401: bad token"):
            await RenderProvider().delete_secrets(["A"], RENDER, "production")
        with pytest.raises(ProviderError, match="Cloudflare API returned 403: forbidden"):
            await CloudflareWorkersProvider().delete_secrets(["A"], CLOUDFLARE, "production")

    async def test_vercel_deploy_redeploys_the_latest_ready_production_deployment(self, http):
        calls, routes = http
        routes[("GET", "/v7/deployments")] = httpx.Response(
            200, json={"deployments": [{"uid": "dpl_1", "name": "my-app"}]}
        )
        routes[("POST", "/v13/deployments")] = httpx.Response(200, json={"id": "dpl_2"})

        await VercelProvider().trigger_deploy(VERCEL)

        listing, create = calls
        assert dict(listing.url.params) == {
            "teamId": "team_1", "projectId": "prj_1", "target": "production", "state": "READY", "limit": "1",
        }
        assert create.url.params["teamId"] == "team_1"
        assert json.loads(create.content) == {"name": "my-app", "deploymentId": "dpl_1", "target": "production"}

    async def test_vercel_deploy_without_a_production_deployment_says_so(self, http):
        calls, routes = http
        routes[("GET", "/v7/deployments")] = httpx.Response(200, json={"deployments": []})

        with pytest.raises(ProviderError, match="Vercel has no production deployment to redeploy"):
            await VercelProvider().trigger_deploy(VERCEL)

        assert self._writes(calls) == []

    async def test_vercel_deploy_reports_a_refusal(self, http):
        _, routes = http
        routes[("GET", "/v7/deployments")] = httpx.Response(200, json={"deployments": [{"uid": "d", "name": "n"}]})
        routes[("POST", "/v13/deployments")] = httpx.Response(402, json={"error": {"message": "payment required"}})

        with pytest.raises(ProviderError, match="Vercel API returned 402: payment required"):
            await VercelProvider().trigger_deploy(VERCEL)

    async def test_render_deploy_creates_a_deploy(self, http):
        calls, routes = http
        routes[("POST", "/v1/services/srv_1/deploys")] = httpx.Response(201, json={"id": "dep_1"})

        await RenderProvider().trigger_deploy(RENDER)

        assert [(c.method, c.url.path) for c in calls] == [("POST", "/v1/services/srv_1/deploys")]
        assert json.loads(calls[0].content) == {}

    async def test_cloudflare_has_no_deploy_to_trigger(self, http):
        calls, _ = http
        with pytest.raises(ProviderError):
            await CloudflareWorkersProvider().trigger_deploy(CLOUDFLARE)
        assert calls == []

    async def test_only_vercel_production_and_render_deploy(self):
        vercel = VercelProvider()
        assert [vercel.deploys_on(t) for t in ("production", "preview", "development")] == [True, False, False]
        assert RenderProvider().deploys_on("staging") is True
        assert CloudflareWorkersProvider().deploys_on("production") is False
