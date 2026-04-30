from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.database import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import UserSignup, UserSignin, AuthResponse, UserResponse, SessionResponse, MessageResponse
from app.middleware.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def _user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=str(user.email),
        name=user.name,
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
        token=session.token,
        expires_at=session.expires_at,
        created_at=session.created_at,
        ip_address=str(session.ip_address) if session.ip_address else None,
        user_agent=session.user_agent,
    )


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: Request,
    response: Response,
    data: UserSignup,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)

    try:
        user, session = await auth_service.create_user(
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
        session=_session_to_response(session),
        session_token=session.token
    )


@router.post("/signin", response_model=AuthResponse)
async def signin(
    request: Request,
    response: Response,
    data: UserSignin,
    db: AsyncSession = Depends(get_db)
):
    auth_service = AuthService(db)

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
        session=_session_to_response(session),
        session_token=session.token
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
