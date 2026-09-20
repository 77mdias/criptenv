from sqlalchemy import UniqueConstraint

from app.models.alert_delivery import AlertDelivery
from app.models.notification import Notification


def test_alert_delivery_has_unique_identity_and_retry_state():
    assert AlertDelivery.__tablename__ == "alert_deliveries"
    assert {column.name for column in AlertDelivery.__table__.columns} >= {
        "id",
        "project_id",
        "expiration_id",
        "event",
        "channel",
        "recipient_key",
        "status",
        "attempts",
        "retry_after",
        "locked_until",
        "claim_token",
        "delivered_at",
        "last_error",
        "created_at",
        "updated_at",
    }

    identities = [
        constraint
        for constraint in AlertDelivery.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    ]
    assert any(
        {column.name for column in constraint.columns}
        == {"expiration_id", "event", "channel", "recipient_key"}
        for constraint in identities
    )


def test_alert_delivery_id_is_the_stable_idempotency_key():
    delivery = AlertDelivery(id="4f7d2c1e-5ea5-4d2c-9b5f-0f5d38b0dd77")

    assert delivery.idempotency_key == "4f7d2c1e-5ea5-4d2c-9b5f-0f5d38b0dd77"


def test_notification_delivery_id_is_nullable_and_unique():
    delivery_id = Notification.__table__.c.delivery_id

    assert delivery_id.nullable is True
    assert any(
        {column.name for column in constraint.columns} == {"delivery_id"}
        for constraint in Notification.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    )
