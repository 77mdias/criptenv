class DomainError(Exception):
    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


class PermissionDenied(DomainError):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(detail, status_code=403)


class InvalidInviteTransition(DomainError):
    pass


class InviteConflict(DomainError):
    def __init__(self, detail: str):
        super().__init__(detail, status_code=409)


class VaultConflict(DomainError):
    def __init__(self, current_version: int, expected_version: int):
        self.current_version = current_version
        self.expected_version = expected_version
        super().__init__(
            f"Version conflict: expected {expected_version}, got {current_version}",
            status_code=409,
        )



class PlanLimitReached(DomainError):
    """402: a create would pass a limit of the plan (app/plans.py). main.py turns it into the response."""

    def __init__(self, key: str, limit: int):
        self.key = key
        self.limit = limit
        super().__init__(f"Plan limit reached: {key} ({limit})", status_code=402)
