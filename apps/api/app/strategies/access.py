from dataclasses import dataclass
from typing import Protocol


ROLE_LEVELS = {
    "viewer": 0,
    "developer": 1,
    "admin": 2,
    "owner": 3,
}


class AccessStrategy(Protocol):
    def can_access(self, member_role: str) -> bool:
        ...


@dataclass(frozen=True)
class MinimumRoleAccessStrategy:
    required_role: str

    def can_access(self, member_role: str) -> bool:
        member_level = ROLE_LEVELS.get(member_role, -1)
        required_level = ROLE_LEVELS.get(self.required_role, 0)
        return member_level >= required_level


class ViewerAccessStrategy(MinimumRoleAccessStrategy):
    def __init__(self):
        super().__init__("viewer")


class DeveloperAccessStrategy(MinimumRoleAccessStrategy):
    def __init__(self):
        super().__init__("developer")


class AdminAccessStrategy(MinimumRoleAccessStrategy):
    def __init__(self):
        super().__init__("admin")


class OwnerAccessStrategy(MinimumRoleAccessStrategy):
    def __init__(self):
        super().__init__("owner")


class DenyAccessStrategy:
    def can_access(self, member_role: str) -> bool:
        return False


ACCESS_STRATEGIES: dict[str, AccessStrategy] = {
    "viewer": ViewerAccessStrategy(),
    "developer": DeveloperAccessStrategy(),
    "admin": AdminAccessStrategy(),
    "owner": OwnerAccessStrategy(),
}


def get_access_strategy(required_role: str | None) -> AccessStrategy:
    return ACCESS_STRATEGIES.get(required_role or "viewer", DenyAccessStrategy())
