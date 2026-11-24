import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database.cache import (
    cache_session,
    check_guest_quota,
    get_guest_enhancement_count,
    invalidate_session,
    set_guest_enhancement_count,
)
from app.database.connection import get_db
from app.database.models import EnhancementRecord, GuestUsage, User
from app.utils.auth import (
    create_access_token,
    get_current_user_optional,
    get_current_user_required,
    hash_password,
    verify_password,
)

logger = logging.getLogger("aquavision.auth.routes")
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication & Profile"])


# ---------------------------------------------------------
# Request & Response Schemas
# ---------------------------------------------------------

class SignUpRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime
    total_enhancements: int
    account_status: str


class AuthTokenResponse(BaseModel):
    token: str
    token_type: str = "Bearer"
    expires_in_hours: int = 24
    user: UserProfileResponse


class GuestStatusResponse(BaseModel):
    guest_id: str
    used: int
    max_allowed: int
    remaining: int
    is_quota_exhausted: bool


# ---------------------------------------------------------
# Endpoints
# ---------------------------------------------------------

@router.post("/signup", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def signup(data: SignUpRequest, db: Session = Depends(get_db)):
    """
    Registers a new researcher with minimum fields (name, email, password),
    immediately issues a 24-hour JWT session token, and logs the user in directly.
    """
    existing_user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in instead."
        )

    # Create new user
    new_user = User(
        name=data.name.strip(),
        email=data.email.lower().strip(),
        hashed_password=hash_password(data.password),
        is_active=True,
        created_at=datetime.now(UTC),
        last_login_at=datetime.now(UTC)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Immediately issue 24-hour JWT token (auto-login on signup)
    token = create_access_token(data={"sub": new_user.id, "email": new_user.email, "name": new_user.name})
    cache_session(token, {"user_id": new_user.id, "email": new_user.email, "name": new_user.name})

    logger.info("New user registered and auto-logged in: %s (%s)", new_user.name, new_user.email)

    return AuthTokenResponse(
        token=token,
        user=UserProfileResponse(
            id=new_user.id,
            name=new_user.name,
            email=new_user.email,
            created_at=new_user.created_at,
            total_enhancements=0,
            account_status="Unlimited Research Account"
        )
    )


@router.post("/login", response_model=AuthTokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user, sets a 24-hour cached session, and updates activity timestamp.
    """
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is currently suspended. Please contact project administrators."
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(UTC)
    db.commit()

    # Issue 24-hour token and cache session
    token = create_access_token(data={"sub": user.id, "email": user.email, "name": user.name})
    cache_session(token, {"user_id": user.id, "email": user.email, "name": user.name})

    total_count = db.query(EnhancementRecord).filter(EnhancementRecord.user_id == user.id).count()

    logger.info("User authenticated: %s (%s)", user.name, user.email)

    return AuthTokenResponse(
        token=token,
        user=UserProfileResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            created_at=user.created_at,
            total_enhancements=total_count,
            account_status="Unlimited Research Account"
        )
    )


@router.post("/logout")
def logout(authorization: str | None = Header(None, alias="Authorization")):
    """
    Invalidates the active token session from the cache.
    The client subsequently reverts to guest mode with a fresh 5-image quota.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        invalidate_session(token)
    return {"status": "success", "message": "Logged out successfully. Reverted to guest mode."}


@router.get("/me", response_model=UserProfileResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """Returns the authenticated user's profile details and aggregate metrics."""
    total_count = db.query(EnhancementRecord).filter(EnhancementRecord.user_id == current_user.id).count()
    return UserProfileResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        created_at=current_user.created_at,
        total_enhancements=total_count,
        account_status="Unlimited Research Account"
    )


@router.get("/history", response_model=list[dict[str, Any]])
def get_user_enhancement_history(
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db)
):
    """
    Returns the user's personal enhancement history, chronologically sorted,
    including side-by-side asset paths, optical quality scores, model used, and timestamps.
    """
    records = (
        db.query(EnhancementRecord)
        .filter(EnhancementRecord.user_id == current_user.id)
        .order_by(EnhancementRecord.created_at.desc())
        .limit(100)
        .all()
    )

    return [
        {
            "id": r.id,
            "filename": r.original_filename,
            "raw_url": r.raw_image_path,
            "enhanced_url": r.enhanced_image_path,
            "annotated_url": r.annotated_image_path,
            "model_name": r.model_name,
            "inference_mode": r.inference_mode,
            "uiqm": r.uiqm_score,
            "uciqe": r.uciqe_score,
            "psnr": r.psnr_score,
            "metrics": r.metrics,
            "detections": r.detections,
            "coral_health": r.coral_health,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in records
    ]


@router.get("/guest-status", response_model=GuestStatusResponse)
def get_guest_status(
    x_guest_id: str | None = Header(None, alias="X-Guest-ID"),
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Returns the remaining enhancement quota for an unauthenticated guest.
    If the user is logged in, reports remaining: 999999 (unlimited).
    """
    if current_user:
        return GuestStatusResponse(
            guest_id="authenticated",
            used=0,
            max_allowed=999999,
            remaining=999999,
            is_quota_exhausted=False
        )

    gid = x_guest_id or "anonymous_guest"
    cached_count = get_guest_enhancement_count(gid)

    # Sync with DB if cache is cold
    if cached_count == 0:
        db_usage = db.query(GuestUsage).filter(GuestUsage.guest_id == gid).first()
        if db_usage:
            cached_count = db_usage.enhancement_count
            set_guest_enhancement_count(gid, cached_count)

    is_allowed, used, max_allowed = check_guest_quota(gid)
    remaining = max(0, max_allowed - used)

    return GuestStatusResponse(
        guest_id=gid,
        used=used,
        max_allowed=max_allowed,
        remaining=remaining,
        is_quota_exhausted=not is_allowed
    )
