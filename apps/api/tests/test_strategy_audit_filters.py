from sqlalchemy import func, select

from app.models.audit import AuditLog
from app.strategies.audit_filters import apply_audit_filters, build_audit_filter_strategies


def normalize_sql(query):
    return " ".join(str(query).split())


def test_audit_filter_strategies_apply_action_and_resource_type_to_any_query():
    filters = build_audit_filter_strategies("project.created", "project")

    data_query = apply_audit_filters(select(AuditLog), filters)
    count_query = apply_audit_filters(select(func.count(AuditLog.id)), filters)

    data_sql = normalize_sql(data_query)
    count_sql = normalize_sql(count_query)

    assert "audit_logs.action" in data_sql
    assert "audit_logs.resource_type" in data_sql
    assert "audit_logs.action" in count_sql
    assert "audit_logs.resource_type" in count_sql


def test_audit_filter_strategy_builder_omits_empty_filters():
    filters = build_audit_filter_strategies(None, None)

    query = apply_audit_filters(select(AuditLog), filters)

    assert "WHERE" not in normalize_sql(query)
