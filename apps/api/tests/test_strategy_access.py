from app.strategies.access import get_access_strategy


def test_role_hierarchy_allows_expected_access():
    assert get_access_strategy(None).can_access("viewer")
    assert get_access_strategy("viewer").can_access("developer")
    assert get_access_strategy("viewer").can_access("admin")
    assert get_access_strategy("viewer").can_access("owner")

    assert get_access_strategy("developer").can_access("developer")
    assert get_access_strategy("developer").can_access("admin")
    assert get_access_strategy("developer").can_access("owner")

    assert get_access_strategy("admin").can_access("admin")
    assert get_access_strategy("admin").can_access("owner")

    assert get_access_strategy("owner").can_access("owner")


def test_role_hierarchy_denies_insufficient_or_unknown_roles():
    assert not get_access_strategy("developer").can_access("viewer")
    assert not get_access_strategy("admin").can_access("developer")
    assert not get_access_strategy("owner").can_access("admin")
    assert not get_access_strategy("admin").can_access("unknown")
    assert not get_access_strategy("unknown").can_access("viewer")

