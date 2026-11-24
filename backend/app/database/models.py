import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def utc_now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    """Registered user account for AquaVision research platform."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_login_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    enhancements = relationship("EnhancementRecord", back_populates="user", cascade="all, delete-orphan")


class EnhancementRecord(Base):
    """
    Persistent log of all processed underwater images (both authenticated and guest).
    Acts as the dataset repository and active-learning warehouse for future retraining.
    """

    __tablename__ = "enhancement_records"

    id = Column(String(64), primary_key=True)  # file_id
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    guest_session_id = Column(String(128), nullable=True, index=True)
    original_filename = Column(String(255), nullable=False)
    raw_image_path = Column(String(512), nullable=False)
    enhanced_image_path = Column(String(512), nullable=False)
    annotated_image_path = Column(String(512), nullable=True)
    model_name = Column(String(64), nullable=False)
    inference_mode = Column(String(64), nullable=False)
    uiqm_score = Column(Float, nullable=True)
    uciqe_score = Column(Float, nullable=True)
    psnr_score = Column(Float, nullable=True)
    metrics = Column(JSON, nullable=True)
    detections = Column(JSON, nullable=True)
    coral_health = Column(JSON, nullable=True)
    is_flagged_for_training = Column(Boolean, default=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True, nullable=False)

    # Relationships
    user = relationship("User", back_populates="enhancements")


class GuestUsage(Base):
    """Persistent tracking of guest quota usage across server restarts."""

    __tablename__ = "guest_usage"

    guest_id = Column(String(128), primary_key=True)
    enhancement_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_activity_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
