from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.config import settings
from app.schemas.auth import (
    UserSignup, UserSignin, AuthResponse, UserResponse, SessionResponse, MessageResponse,
    ForgotPasswordRequest, ForgotPasswordResponse, ResetPasswordRequest, ChangePasswordRequest,
    UpdateProfileRequest, TwoFactorSetupResponse, TwoFactorVerifyRequest, TwoFactorDisableRequest,
    VerifyEmailRequest, SendVerificationResponse, VerifyEmailResponse,
)
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


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


@router.post("/signup", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: Request,
    data: UserSignup,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    email_service = EmailService()

    try:
        user, _session = await auth_service.create_user(
            email=data.email,
            password=data.password,
            name=data.name,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent")
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )

    # Send verification email
    verification = await auth_service.create_email_verification(data.email)
    if verification:
        frontend_url = settings.FRONTEND_URL.rstrip("/")
        verification_url = f"{frontend_url}/verify-email?token={verification.token}"
        email_service.send_email_verification(data.email, verification_url)

    return MessageResponse(
        message="Account created successfully. Please check your email to verify your account."
    )


@router.post("/signin", response_model=AuthResponse)
async def signin(
    request: Request,
    response: Response,
    data: UserSignin,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    email_service = EmailService()

    try:
        user, session = await auth_service.authenticate_user(
            email=data.email,
            password=data.password,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent")
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )

    # Check if email is verified
    if not user.email_verified:
        # Resend verification email for convenience
        verification = await auth_service.create_email_verification(data.email)
        if verification:
            frontend_url = settings.FRONTEND_URL.rstrip("/")
            verification_url = f"{frontend_url}/verify-email?token={verification.token}"
            email_service.send_email_verification(data.email, verification_url)

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. A new verification email has been sent. Please check your inbox."
        )

    response.set_cookie(
        key="session_token",
        value=session.token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=30 * 24 * 60 * 60
    )

    return AuthResponse(
        user=_user_to_response(user),
        session=_session_to_response(session)
    )


@router.post("/signout", response_model=MessageResponse)
async def signout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if token:
        auth_service = AuthService(db)
        await auth_service.invalidate_session(token)

    response.delete_cookie("session_token")

    return MessageResponse(message="Successfully signed out")


@router.get("/session", response_model=UserResponse)
async def get_session(
    current_user: User = Depends(get_current_user)
):
    return _user_to_response(current_user)


@router.get("/sessions", response_model=list[SessionResponse])
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    sessions = await auth_service.get_user_sessions(current_user.id)
    return [_session_to_response(s) for s in sessions]


# ─── Password Reset ─────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    email_service = EmailService()

    reset = await auth_service.create_password_reset(data.email)
    if reset:
        # Build reset URL
        frontend_url = settings.FRONTEND_URL.rstrip("/")
        reset_url = f"{frontend_url}/reset-password?token={reset.token}"
        email_service.send_password_reset(data.email, reset_url)

        # Dev fallback: expose token when email service is not configured
        if not email_service.enabled:
            return ForgotPasswordResponse(
                message="If an account exists with this email, a reset link has been sent.",
                dev_token=reset.token,
                dev_warning="Email service is not configured (RESEND_API_KEY is missing). This token is exposed for local development only. In production, configure RESEND_API_KEY to hide this value.",
            )

    # Always return success to prevent email enumeration
    return ForgotPasswordResponse(message="If an account exists with this email, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    success = await auth_service.reset_password(data.token, data.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired token"
        )
    return MessageResponse(message="Password reset successfully. Please sign in with your new password.")


# ─── Email Verification ─────────────────────────────────────────────────────

@router.post("/send-verification", response_model=SendVerificationResponse)
async def send_verification(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """Send or resend an email verification link."""
    auth_service = AuthService(db)
    email_service = EmailService()

    verification = await auth_service.create_email_verification(data.email)
    if verification:
        frontend_url = settings.FRONTEND_URL.rstrip("/")
        verification_url = f"{frontend_url}/verify-email?token={verification.token}"
        email_service.send_email_verification(data.email, verification_url)

        # Dev fallback: expose token when email service is not configured
        if not email_service.enabled:
            return SendVerificationResponse(
                message="If the account exists and is unverified, a verification link has been sent.",
                dev_token=verification.token,
                dev_warning="Email service is not configured (RESEND_API_KEY is missing). This token is exposed for local development only.",
            )

    # Always return success to prevent email enumeration
    return SendVerificationResponse(message="If the account exists and is unverified, a verification link has been sent.")


@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    data: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    """Verify an email address using a token."""
    auth_service = AuthService(db)
    email_service = EmailService()
    user = await auth_service.verify_email(data.token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    # Send welcome email on first verification
    email_service.send_welcome(to=str(user.email), name=user.name or "")

    return VerifyEmailResponse(message="Email verified successfully. You can now sign in.", email_verified=True)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    success = await auth_service.change_password(current_user, data.current_password, data.new_password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect"
        )
    return MessageResponse(message="Password changed successfully. Please sign in again.")


# ─── Profile Management ─────────────────────────────────────────────────────

@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    email_service = EmailService()

    # Capture old email before potential change
    old_email = str(current_user.email) if data.email and data.email != str(current_user.email) else None

    try:
        user = await auth_service.update_profile(
            current_user,
            name=data.name,
            email=data.email
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )

    # Send email change notifications if email was updated
    if old_email and data.email:
        email_service.send_email_changed(to=data.email, old_email=old_email)
        email_service.send_email_changed_alert_to_old(to=old_email, new_email=data.email)

    return _user_to_response(user)


@router.delete("/me", response_model=MessageResponse)
async def delete_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):

    auth_service = AuthService(db)
    email_service = EmailService()

    # Send notification before deletion
    email_service.send_account_deleted(str(current_user.email))

    await auth_service.delete_account(current_user)
    return MessageResponse(message="Account deleted successfully.")


# ─── Two-Factor Authentication ──────────────────────────────────────────────

@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    secret_uri = await auth_service.setup_2fa(current_user)

    # Generate 8 backup codes
    import secrets
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]

    return TwoFactorSetupResponse(secret_uri=secret_uri, backup_codes=backup_codes)


@router.post("/2fa/verify", response_model=MessageResponse)
async def verify_2fa(
    data: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    email_service = EmailService()

    success = await auth_service.verify_and_enable_2fa(current_user, data.code)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )

    email_service.send_2fa_enabled(str(current_user.email))
    return MessageResponse(message="Two-factor authentication enabled successfully.")


@router.get("/invites/lookup", response_model=dict)
async def lookup_invite_by_token(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Lookup an invite by token to show project info before accepting."""
    auth_service = AuthService(db)
    invite = await auth_service.get_invite_by_token(token)
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invite not found or expired"
        )
    return {
        "project_id": str(invite.project_id),
        "email": invite.email,
        "role": invite.role,
        "expires_at": invite.expires_at.isoformat() if invite.expires_at else None,
    }


@router.post("/invites/accept", response_model=MessageResponse)
async def accept_invite_by_token(
    request: Request,
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Accept a project invite using a token from an email link."""
    auth_service = AuthService(db)
    audit_service = AuditService(db)

    invite = await auth_service.accept_invite_by_token(token, current_user)
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already accepted invite"
        )

    await audit_service.log(
        action="invite.accepted",
        resource_type="invite",
        resource_id=invite.id,
        user_id=current_user.id,
        project_id=invite.project_id,
        metadata={"token": token},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent")
    )

    return MessageResponse(message="Invite accepted successfully.")


@router.post("/2fa/disable", response_model=MessageResponse)
async def disable_2fa(
    data: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)
    success = await auth_service.disable_2fa(current_user, data.password)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password is incorrect"
        )
    return MessageResponse(message="Two-factor authentication disabled successfully.")
