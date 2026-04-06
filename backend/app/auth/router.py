from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth.models import RefreshRequest, Token, UserCreate, UserLogin, UserResponse
from app.auth.service import login_user, refresh_access_token, register_user
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=dict, status_code=201)
async def register(user_create: UserCreate):
    """Register a new user and return the user info together with a token pair."""
    user = register_user(user_create)
    from app.auth.service import create_access_token, create_refresh_token

    token = Token(
        access_token=create_access_token({"sub": user["id"]}),
        refresh_token=create_refresh_token({"sub": user["id"]}),
    )
    user_response = UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        created_at=user["created_at"],
    )
    return {
        "user": user_response.model_dump(),
        "access_token": token.access_token,
        "refresh_token": token.refresh_token,
        "token_type": token.token_type,
    }


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Authenticate and return a JWT token pair."""
    return login_user(credentials.email, credentials.password)


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    """Exchange a valid refresh token for a new access token."""
    new_access = refresh_access_token(body.refresh_token)
    return {"access_token": new_access, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile."""
    return UserResponse(
        id=current_user["id"],
        username=current_user["username"],
        email=current_user["email"],
        created_at=current_user["created_at"],
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout endpoint.  JWTs are stateless; clients should discard their tokens.
    A future implementation could maintain a server-side denylist.
    """
    return {"detail": "Logged out successfully"}
