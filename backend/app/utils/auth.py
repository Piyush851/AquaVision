import logging
import os
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.database.cache import cache_session, get_cached_session
from app.database.connection import get_db
from app.database.models import User

logger = logging.getLogger("aquavision.auth")

SECRET_KEY = os.getenv("JWT_SECRET", "aquavision_jwt_secret_key_2026_super_secure_marine_vision")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("SESSION_EXPIRE_HOURS", "24"))


def hash_password(plain_password: str) -> str:
    """Securely hashes a plaintext password using bcrypt with random salt."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against the stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Generates a signed JWT access token with a 24-hour expiration window."""
    to_encode = data.copy()
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode.update({"exp": expire, "iat": now})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decodes and validates a JWT token signature and expiration."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.PyJWTError, ValueError) as e:
        logger.debug("JWT decode failure: %s", e)
        return None


def get_current_user_optional(
    authorization: str | None = Header(None, alias="Authorization"),
    db: Session = Depends(get_db)
) -> User | None:
    """
    FastAPI dependency that extracts the authenticated user if Bearer token is provided.
    Uses the in-memory 24-hour session cache for sub-millisecond lookups.
    Returns None if the request is from an unauthenticated guest.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        return None

    # Check fast cache first
    cached = get_cached_session(token)
    if cached and "user_id" in cached:
        user = db.query(User).filter(User.id == cached["user_id"], User.is_active.is_(True)).first()
        if user:
            return user

    # Decode JWT if cache miss
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if user:
        cache_session(token, {"user_id": user.id, "email": user.email, "name": user.name})
        return user

    return None


def get_current_user_required(
    current_user: User | None = Depends(get_current_user_optional)
) -> User:
    """Enforces authentication: raises HTTP 401 if request is not authenticated."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in or create an account.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return current_user
