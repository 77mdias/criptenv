from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services.auth_service import AuthService
from app.services.oauth_service import OAuthService
from app.schemas.auth import AuthResponse, UserResponse, SessionResponse
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/auth/oauth", tags=["Authentication"])

SESSION_COOKIE = "session_token"
TWO_FACTOR_CHALLENGE_COOKIE = "two_factor_challenge"
TWO_FACTOR_DEVICE_COOKIE = "two_factor_device"
TWO_FACTOR_CHALLENGE_MAX_AGE = 10 * 60


def _cookie_secure() -> bool:
    return not settings.DEBUG


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        max_age=30 * 24 * 60 * 60,
    )


def _set_two_factor_challenge_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=TWO_FACTOR_CHALLENGE_COOKIE,
        value=token,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        max_age=TWO_FACTOR_CHALLENGE_MAX_AGE,
    )


def _get_public_request_base_url(request: Request) -> str:
    forwarded_host = request.headers.get("x-forwarded-host")
    forwarded_proto = request.headers.get("x-forwarded-proto")

    if forwarded_host:
        host = forwarded_host.split(",", 1)[0].strip()
        proto = (forwarded_proto or request.url.scheme).split(",", 1)[0].strip()
        return f"{proto}://{host}"

    return settings.API_URL.rstrip("/")


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=str(user.email),
        name=user.name,
        kdf_salt=user.kdf_salt,
        avatar_url=user.avatar_url,
        email_verified=user.email_verified,
        two_factor_enabled=user.two_factor_enabled,
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at,
    )


def _session_to_response(session) -> SessionResponse:
    return SessionResponse(
        id=session.id,
        user_id=session.user_id,
        expires_at=session.expires_at,
        created_at=session.created_at,
        ip_address=str(session.ip_address) if session.ip_address else None,
        user_agent=session.user_agent,
    )


@router.get("/accounts", response_model=list)
async def list_oauth_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all OAuth accounts linked to the current user."""
    oauth_service = OAuthService(db)
    accounts = await oauth_service.get_user_oauth_accounts(current_user.id)
    
    return [
        {
            "id": str(acc.id),
            "provider": acc.provider,
            "provider_email": acc.provider_email,
            "created_at": acc.created_at.isoformat() if acc.created_at else None,
        }
        for acc in accounts
    ]


@router.get("/{provider}")
async def oauth_initiate(
    provider: str,
    request: Request,
    response: Response,
    action: str = "login",
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate OAuth flow for the specified provider.
    
    Redirects to the provider's authorization page.
    """
    if provider not in ["github", "google", "discord"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown OAuth provider: {provider}. Supported: github, google, discord"
        )
    
    oauth_service = OAuthService(db)
    public_base_url = _get_public_request_base_url(request)
    
    try:
        auth_url, state = await oauth_service.get_authorization_url(provider, public_base_url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Encode state for cookie
    encoded_state = OAuthService.encode_state(provider, state, action)
    
    # Create redirect response with state cookie
    redirect_response = RedirectResponse(url=auth_url, status_code=307)
    redirect_response.set_cookie(
        key="oauth_state",
        value=encoded_state,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=600,  # 10 minutes
    )
    
    return redirect_response


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle OAuth callback from provider.
    
    Validates state, exchanges code for tokens, and creates/links user account.
    """
    if provider not in ["github", "google", "discord"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown OAuth provider: {provider}. Supported: github, google, discord"
        )
    
    # Validate state from cookie
    stored_state = request.cookies.get("oauth_state")
    if not stored_state:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OAuth state missing. Please try again."
        )
    
    try:
        stored_provider, stored_state_value, action = OAuthService.decode_state(stored_state)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OAuth state. Please try again."
        )
    
    if stored_provider != provider or stored_state_value != state:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OAuth state mismatch. Please try again."
        )
    
    current_user = None
    if action == "link":
        from app.middleware.auth import get_optional_user
        current_user = await get_optional_user(request, db)
        if not current_user:
            # If linking, we MUST be authenticated.
            # Redirect to login with error if session is missing
            from urllib.parse import quote
            err_msg = quote("You must be logged in to link accounts")
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL.rstrip('/')}/login?error={err_msg}",
                status_code=307
            )

    oauth_service = OAuthService(db)
    
    try:
        user, session = await oauth_service.authenticate_with_oauth(
            provider=provider,
            code=code,
            base_url=_get_public_request_base_url(request),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            link_to_user=current_user,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        if action == "link":
            from urllib.parse import quote
            err_msg = quote(str(e) or 'Authentication failed')
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL.rstrip('/')}/account?oauth_error={err_msg}",
                status_code=307
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth authentication failed: {type(e).__name__}: {str(e) or 'No details'}"
        )
    
    if action == "link":
        redirect_response = RedirectResponse(
            url=f"{settings.FRONTEND_URL.rstrip('/')}/account?oauth_linked={provider}",
            status_code=307
        )
        redirect_response.delete_cookie("oauth_state")
        return redirect_response

    auth_service = AuthService(db)
    if user.two_factor_enabled:
        trusted = await auth_service.is_trusted_two_factor_device(
            user_id=user.id,
            device_token=request.cookies.get(TWO_FACTOR_DEVICE_COOKIE),
            user_agent=request.headers.get("User-Agent"),
        )
        if trusted:
            session = await auth_service.create_session_for_login(
                user=user,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent"),
            )
        else:
            challenge_token, _challenge = await auth_service.create_two_factor_challenge(
                user_id=user.id,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent"),
            )
            redirect_response = RedirectResponse(
                url=f"{settings.FRONTEND_URL.rstrip('/')}/2fa?next=%2Fdashboard",
                status_code=307,
            )
            redirect_response.delete_cookie("oauth_state")
            _set_two_factor_challenge_cookie(redirect_response, challenge_token)
            return redirect_response

    if session is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OAuth authentication did not create a session."
        )

    # Redirect to frontend OAuth callback page
    # The session cookie will be sent with this redirect
    frontend_callback_url = f"{settings.FRONTEND_URL.rstrip('/')}/oauth/callback"
    redirect_response = RedirectResponse(url=frontend_callback_url, status_code=307)
    redirect_response.delete_cookie("oauth_state")
    _set_session_cookie(redirect_response, session.token)
    return redirect_response


@router.delete("/{provider}")
async def unlink_oauth_account(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlink an OAuth account from the current user."""
    if provider not in ["github", "google", "discord"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown OAuth provider: {provider}"
        )
    
    oauth_service = OAuthService(db)
    success = await oauth_service.unlink_oauth_account(current_user.id, provider)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {provider} account linked to this user"
        )
    
    return {"message": f"{provider.title()} account unlinked successfully"}
