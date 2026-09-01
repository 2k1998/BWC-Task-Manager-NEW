from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import secrets

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token, hash_password
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter
from app.models.user import User
from app.models.auth import AuthRefreshToken
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.schemas.user import UserResponse
from app.schemas.permission import CurrentUserModulePermissionsResponse
from app.utils.permissions import get_user_module_permissions_map

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Bcrypt hash of a throwaway random value, used to equalise login response time
# when the account does not exist (see login below). Never matches any input.
_DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(32))

# Generic message for both "no such user" and "wrong password" - never reveal which.
_INVALID_CREDENTIALS = "Incorrect username/email or password"


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(
    request: Request,
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login with username/email and password.
    Returns JWT access token and refresh token.
    """
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == login_data.username_or_email) |
        (User.email == login_data.username_or_email)
    ).first()

    if not user:
        # Burn one bcrypt verification against a dummy hash so that an unknown
        # account takes the same time as a known one with a wrong password.
        # Without this, response timing enumerates valid usernames/emails.
        verify_password(login_data.password, _DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_CREDENTIALS
        )

    # Verify password
    if not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_CREDENTIALS
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact an administrator."
        )
    
    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token_value = create_refresh_token(data={"sub": str(user.id)})
    
    # Store refresh token in database
    refresh_token = AuthRefreshToken(
        user_id=user.id,
        token=refresh_token_value,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token)
    db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_value
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("10/minute")
def refresh_token(
    request: Request,
    refresh_data: RefreshRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token.

    The presented refresh token is rotated: it is deleted and a fresh one is
    issued, so a leaked token is single-use.
    """
    # Decode refresh token
    payload = decode_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Check if refresh token exists in database
    stored_token = db.query(AuthRefreshToken).filter(
        AuthRefreshToken.token == refresh_data.refresh_token
    ).first()
    
    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found"
        )
    
    # Check if token is expired
    if stored_token.expires_at < datetime.now(timezone.utc):
        db.delete(stored_token)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired"
        )
    
    # Get user
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Rotate: invalidate the presented refresh token and issue a new one.
    db.delete(stored_token)

    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token_value = create_refresh_token(data={"sub": str(user.id)})

    db.add(AuthRefreshToken(
        user_id=user.id,
        token=new_refresh_token_value,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ))
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token_value
    )



@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current user.
    """
    return current_user


@router.get("/me/module-permissions", response_model=CurrentUserModulePermissionsResponse)
def get_my_module_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Module access levels for the authenticated user (for UI gating)."""
    return CurrentUserModulePermissionsResponse(
        permissions=get_user_module_permissions_map(db, current_user.id)
    )


@router.post("/logout")
def logout(
    refresh_data: RefreshRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Logout by invalidating refresh token.
    """
    # Delete refresh token from database
    stored_token = db.query(AuthRefreshToken).filter(
        AuthRefreshToken.token == refresh_data.refresh_token,
        AuthRefreshToken.user_id == current_user.id
    ).first()
    
    if stored_token:
        db.delete(stored_token)
        db.commit()
    
    return {"message": "Logged out successfully"}
