from typing import Protocol

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


def build_audit_filter_strategies(
    action: str | None,
    resource_type: str | None,
) -> list[AuditFilterStrategy]:
    strategies: list[AuditFilterStrategy] = []
    if action:
        strategies.append(ActionAuditFilterStrategy(action))
    if resource_type:
        strategies.append(ResourceTypeAuditFilterStrategy(resource_type))
    return strategies


def apply_audit_filters(query: Select, filters: list[AuditFilterStrategy]) -> Select:
    for filter_strategy in filters:
        query = filter_strategy.apply(query)
    return query

