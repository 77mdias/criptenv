from app.routers.auth import router as auth_router
from app.routers.oauth import router as oauth_router
from app.routers.projects import router as projects_router
from app.routers.environments import router as environments_router
from app.routers.vault import router as vault_router
from app.routers.members import router as members_router
from app.routers.invites import router as invites_router
from app.routers.audit import router as audit_router
from app.routers.tokens import router as tokens_router
from app.routers.ci import router as ci_router
from app.routers.integrations import router as integrations_router

__all__ = [
    "auth_router",
    "oauth_router",
    "projects_router",
    "environments_router",
    "vault_router",
    "members_router",
    "invites_router",
    "audit_router",
    "tokens_router",
    "ci_router",
    "integrations_router"
]
