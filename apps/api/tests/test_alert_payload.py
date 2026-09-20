from datetime import datetime, timezone
from uuid import uuid4

from app.services.alert_payload import build_alert_payload


def test_expiration_payload_contains_identity_and_no_secret_material():
    project_id = uuid4()
    environment_id = uuid4()
    expires_at = datetime(2026, 9, 20, tzinfo=timezone.utc)

    payload = build_alert_payload(
        event="secret.expiring",
        project_id=project_id,
        project_name="Payments",
        environment_id=environment_id,
        environment_name="Production",
        action_url=f"/projects/{project_id}/secrets/API_KEY",
        secret_key="API_KEY",
        expires_at=expires_at,
        test=False,
    )

    assert payload["payload_version"] == 1
    assert payload["test"] is False
    assert payload["project_id"] == str(project_id)
    assert payload["project_name"] == "Payments"
    assert payload["environment_id"] == str(environment_id)
    assert payload["environment_name"] == "Production"
    assert payload["action_url"].startswith(f"/projects/{project_id}/")
    assert all(
        field not in payload
        for field in ("value", "ciphertext", "encrypted_value", "iv", "auth_tag", "vault_password")
    )


def test_test_payload_is_marked_as_synthetic():
    payload = build_alert_payload(project_id=uuid4(), event="alert.test", test=True)

    assert payload["payload_version"] == 1
    assert payload["test"] is True
