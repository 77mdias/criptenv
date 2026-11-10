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


class PlanFeatureRequired(DomainError):
    """402: the plan of the project's owner lacks a feature (app/plans.py). Same handler as PlanLimitReached."""

    def __init__(self, feature: str):
        self.feature = feature
        super().__init__(f"Plan feature required: {feature}", status_code=402)


class BillingConflict(DomainError):
    """409: the subscription is not in a state that allows the action."""

    def __init__(self, detail: str):
        super().__init__(detail, status_code=409)


class BillingProviderError(DomainError):
    """502: Mercado Pago did not do what billing needed; nothing was changed on our side."""

    def __init__(self, detail: str = "The payment provider is unavailable. Try again in a few minutes."):
        super().__init__(detail, status_code=502)
