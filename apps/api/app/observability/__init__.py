"""Structured logging, request correlation and optional error tracking.

The API used plain-text logging with production at WARNING+, no request
correlation and no error tracking (audit 2026-10, "zero observability").
This module provides:

- ``JsonFormatter``: one JSON object per log line, including the current
  request id when one is bound.
- ``request_id_var``: a contextvar carrying the per-request correlation id,
  set by ``RequestContextMiddleware``.
- ``configure_logging()``: installs the formatter/level once at startup.
- ``init_error_tracking()``: initialises Sentry **only** when SENTRY_DSN is
  configured and sentry-sdk is installed (soft dependency).
"""

import json
import logging
import os
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any, Optional

request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)

# LogRecord attributes that are part of every record; anything else is
# treated as a structured extra and included in the JSON payload.
_RESERVED = {
    "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
    "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
    "created", "msecs", "relativeCreated", "thread", "threadName",
    "processName", "process", "taskName", "message", "asctime",
}


class JsonFormatter(logging.Formatter):
    """Render log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": time.strftime(
                "%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)
            )
            + f".{int(record.msecs):03d}Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = getattr(record, "request_id", None) or request_id_var.get()
        if request_id:
            payload["request_id"] = request_id

        for key, value in record.__dict__.items():
            if key not in _RESERVED and key != "request_id":
                try:
                    json.dumps(value)
                    payload[key] = value
                except (TypeError, ValueError):
                    payload[key] = repr(value)

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging() -> None:
    """Configure root logging once (JSON in production, text in debug)."""
    log_format = os.getenv("LOG_FORMAT", "").strip().lower()
    use_json = log_format == "json" or (not settings_is_debug() and log_format != "text")

    level_name = os.getenv("LOG_LEVEL", "").strip().upper()
    if level_name:
        level = getattr(logging, level_name, logging.INFO)
    else:
        # Production must not hide INFO-level operational events (the old
        # default was WARNING+, which masked login/webhook activity).
        level = logging.DEBUG if settings_is_debug() else logging.INFO

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if use_json else logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    ))

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


def settings_is_debug() -> bool:
    try:
        from app.config import settings

        return bool(settings.DEBUG)
    except Exception:  # pragma: no cover - settings should always import
        return False


def new_request_id() -> str:
    return uuid.uuid4().hex


def init_error_tracking() -> bool:
    """Initialise Sentry when configured. Returns True when active.

    Soft dependency: environments without ``SENTRY_DSN`` (or without the
    SDK installed) simply skip error tracking.
    """
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return False

    try:
        import sentry_sdk  # type: ignore
    except ImportError:
        logging.getLogger(__name__).warning(
            "SENTRY_DSN is set but sentry-sdk is not installed; error tracking disabled"
        )
        return False

    try:
        from app.config import settings

        environment = os.getenv("SENTRY_ENVIRONMENT") or getattr(
            settings, "APP_ENV", "production"
        )
    except Exception:
        environment = os.getenv("SENTRY_ENVIRONMENT", "production")

    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.0")),
        send_default_pii=False,  # never ship secrets/PII by default
    )
    return True
