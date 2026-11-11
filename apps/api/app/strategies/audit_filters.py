from datetime import datetime
from typing import Protocol
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.sql import Select

from app.models.audit import AuditLog


class AuditFilterStrategy(Protocol):
    def apply(self, query: Select) -> Select:
        ...


class ActionAuditFilterStrategy:
    def __init__(self, action: str):
        self.action = action

    def apply(self, query: Select) -> Select:
        return query.where(AuditLog.action == self.action)


class ResourceTypeAuditFilterStrategy:
    def __init__(self, resource_type: str):
        self.resource_type = resource_type

    def apply(self, query: Select) -> Select:
        return query.where(AuditLog.resource_type == self.resource_type)


class AuthTypeAuditFilterStrategy:
    """Origin of the action. A log without `auth_type` in its metadata is a session action."""

    def __init__(self, auth_type: str):
        self.auth_type = auth_type

    def apply(self, query: Select) -> Select:
        stored = AuditLog.meta["auth_type"].as_string()
        if self.auth_type == "session":
            return query.where(or_(stored.is_(None), stored.notin_(("api_key", "ci_session"))))
        return query.where(stored == self.auth_type)


class ActorAuditFilterStrategy:
    def __init__(self, actor_id: UUID):
        self.actor_id = actor_id

    def apply(self, query: Select) -> Select:
        return query.where(AuditLog.user_id == self.actor_id)


class DateRangeAuditFilterStrategy:
    def __init__(self, since: datetime | None, until: datetime | None):
        self.since, self.until = since, until

    def apply(self, query: Select) -> Select:
        if self.since is not None:
            query = query.where(AuditLog.created_at >= self.since)
        if self.until is not None:
            query = query.where(AuditLog.created_at <= self.until)
        return query


def build_audit_filter_strategies(
    action: str | None,
    resource_type: str | None,
    auth_type: str | None = None,
    actor_id: UUID | None = None,
    since: datetime | None = None,
    until: datetime | None = None,
) -> list[AuditFilterStrategy]:
    strategies: list[AuditFilterStrategy] = []
    if action:
        strategies.append(ActionAuditFilterStrategy(action))
    if resource_type:
        strategies.append(ResourceTypeAuditFilterStrategy(resource_type))
    if auth_type:
        strategies.append(AuthTypeAuditFilterStrategy(auth_type))
    if actor_id:
        strategies.append(ActorAuditFilterStrategy(actor_id))
    if since or until:
        strategies.append(DateRangeAuditFilterStrategy(since, until))
    return strategies


def apply_audit_filters(query: Select, filters: list[AuditFilterStrategy]) -> Select:
    for filter_strategy in filters:
        query = filter_strategy.apply(query)
    return query

