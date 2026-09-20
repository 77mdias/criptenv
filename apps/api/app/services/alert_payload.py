from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AlertPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: str
    payload_version: int = 1
    test: bool = False
    project_id: UUID
    project_name: str | None = None
    environment_id: UUID | None = None
    environment_name: str | None = None
    action_url: str | None = None
    environment: str | None = None
    secret_key: str | None = None
    expires_at: datetime | None = None
    notify_days_before: int | None = None
    days_until_expiration: int | None = None
    timestamp: datetime | None = None


def build_alert_payload(
    *,
    project_id: UUID,
    project_name: str | None = None,
    environment_id: UUID | None = None,
    environment_name: str | None = None,
    action_url: str | None = None,
    test: bool = False,
    event: str = "alert.test",
    environment: str | None = None,
    secret_key: str | None = None,
    expires_at: datetime | None = None,
    notify_days_before: int | None = None,
    days_until_expiration: int | None = None,
    timestamp: datetime | None = None,
) -> dict[str, Any]:
    return AlertPayload(
        event=event,
        project_id=project_id,
        project_name=project_name,
        environment_id=environment_id,
        environment_name=environment_name,
        action_url=action_url,
        test=test,
        environment=environment,
        secret_key=secret_key,
        expires_at=expires_at,
        notify_days_before=notify_days_before,
        days_until_expiration=days_until_expiration,
        timestamp=timestamp or datetime.now(timezone.utc),
    ).model_dump(mode="json", exclude_none=True)
