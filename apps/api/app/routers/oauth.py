from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.oauth_service import OAuthService
from app.schemas.auth import AuthResponse, UserResponse, SessionResponse
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/auth/oauth", tags=["Authentication"])


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


@router.get("/{provider}")
async def oauth_initiate(
    provider: str,
    response: Response,
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
    
    try:
        auth_url, state = await oauth_service.get_authorization_url(provider)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # Encode state for cookie
    encoded_state = OAuthService.encode_state(provider, state)
    
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
    response: Response,
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
        stored_provider, stored_state_value = OAuthService.decode_state(stored_state)
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
    
    # Clear state cookie
    response.delete_cookie("oauth_state")
    
    oauth_service = OAuthService(db)
    
    try:
        user, session = await oauth_service.authenticate_with_oauth(
            provider=provider,
            code=code,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth authentication failed: {type(e).__name__}: {str(e) or 'No details'}"
        )
    
    # Set session cookie - always allow in development for HTTP
    # In production with HTTPS, use secure=True
    response.set_cookie(
        key="session_token",
        value=session.token,
        httponly=True,
        secure=False,  # Allow over HTTP for development
        samesite="lax",
        max_age=30 * 24 * 60 * 60,
    )
    
    # Redirect to frontend OAuth callback page
    # The session cookie will be sent with this redirect
    from app.config import settings
    frontend_callback_url = f"{settings.FRONTEND_URL}/oauth/callback"
    return RedirectResponse(url=frontend_callback_url, status_code=307)


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
