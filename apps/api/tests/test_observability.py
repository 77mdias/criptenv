"""Tests for structured logging, request correlation and error tracking (Sprint 2).

The API previously logged plain text with production at WARNING+ and had no
request correlation or error tracking (audit 2026-10).
"""

import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.request_context import RequestContextMiddleware
from app.observability import (
    JsonFormatter,
    init_error_tracking,
    new_request_id,
    request_id_var,
)


def _record(**extra):
    record = logging.LogRecord(
        name="app.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )
    for key, value in extra.items():
        setattr(record, key, value)
    return record


class TestJsonFormatter:
    def test_emits_single_line_json(self):
        payload = json.loads(JsonFormatter().format(_record()))
        assert payload["level"] == "INFO"
        assert payload["logger"] == "app.test"
        assert payload["message"] == "hello world"
        assert payload["timestamp"].endswith("Z")

    def test_includes_bound_request_id(self):
        token = request_id_var.set("req-abc")
        try:
            payload = json.loads(JsonFormatter().format(_record()))
        finally:
            request_id_var.reset(token)
        assert payload["request_id"] == "req-abc"

    def test_includes_structured_extras(self):
        payload = json.loads(JsonFormatter().format(_record(user_id="u1", count=3)))
        assert payload["user_id"] == "u1"
        assert payload["count"] == 3

    def test_never_crashes_on_unserializable_extras(self):
        payload = json.loads(JsonFormatter().format(_record(obj=object())))
        assert isinstance(payload["obj"], str)


class TestRequestContextMiddleware:
    def _app(self):
        app = FastAPI()
        app.add_middleware(RequestContextMiddleware)

        @app.get("/ping")
        async def ping():
            return {"request_id": request_id_var.get()}

        return app

    def test_generates_request_id_and_echoes_header(self):
        with TestClient(self._app()) as client:
            response = client.get("/ping")
        assert response.status_code == 200
        header_id = response.headers["X-Request-ID"]
        assert header_id
        assert response.json()["request_id"] == header_id

    def test_honours_incoming_request_id(self):
        with TestClient(self._app()) as client:
            response = client.get("/ping", headers={"X-Request-ID": "trace-123"})
        assert response.headers["X-Request-ID"] == "trace-123"
        assert response.json()["request_id"] == "trace-123"

    def test_sanitizes_incoming_header(self):
        with TestClient(self._app()) as client:
            response = client.get(
                "/ping", headers={"X-Request-ID": "bad\r\ninjected\tvalue"}
            )
        request_id = response.headers["X-Request-ID"]
        assert "\n" not in request_id and "\r" not in request_id and "\t" not in request_id
        assert "injected" in request_id

    def test_oversized_incoming_id_is_truncated(self):
        with TestClient(self._app()) as client:
            response = client.get("/ping", headers={"X-Request-ID": "a" * 500})
        assert len(response.headers["X-Request-ID"]) <= 128


class TestErrorTracking:
    def test_disabled_without_dsn(self, monkeypatch):
        monkeypatch.delenv("SENTRY_DSN", raising=False)
        assert init_error_tracking() is False

    def test_new_request_id_is_unique(self):
        assert new_request_id() != new_request_id()
