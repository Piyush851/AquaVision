import logging
import os
from collections.abc import Generator
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.exc import DBAPIError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from urllib.parse import quote_plus

from app.database.models import Base

logger = logging.getLogger("aquavision.database")

# Resolve default paths and env configuration
backend_root = Path(__file__).resolve().parent.parent.parent
DEFAULT_POSTGRES_URL = "postgresql://aquavision_user:piyush%402004@127.0.0.1:5432/aquavision"
FALLBACK_SQLITE_URL = f"sqlite:///{backend_root / 'aquavision_fallback.db'}"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_POSTGRES_URL)


def normalize_db_url(url: str) -> str:
    """Auto-normalizes driver prefix and URL-encodes raw '@' symbols in password."""
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    prefix, sep, rest = url.partition("://")
    if sep and "@" in rest:
        auth_part, host_part = rest.rsplit("@", 1)
        if ":" in auth_part:
            user, password = auth_part.split(":", 1)
            if "@" in password and "%40" not in password:
                password = quote_plus(password)
                url = f"{prefix}://{user}:{password}@{host_part}"
    return url


def create_db_engine(db_url: str):
    """Creates a resilient SQLAlchemy engine with connection pooling and health probes."""
    db_url = normalize_db_url(db_url)

    if db_url.startswith("sqlite"):
        return create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            echo=False
        )
    return create_engine(
        db_url,
        connect_args={"connect_timeout": 3},
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Probes connection liveness before checkout
        pool_recycle=3600,   # Recycles stale connections every hour
        echo=False
    )


# Attempt engine connection with zero-crash SQLite fallback
engine = None
try:
    engine = create_db_engine(DATABASE_URL)
    with engine.connect() as conn:
        print(f"[AquaVision DB] Successfully connected to PostgreSQL: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
        logger.info("Successfully connected to primary database: %s", DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL)
except (SQLAlchemyError, DBAPIError, OperationalError, OSError, ValueError, ImportError) as e:
    print(f"[AquaVision DB] Primary database connection failed ({e}). Activating zero-downtime fallback SQLite database.")
    logger.warning("Primary database connection failed (%s). Activating local zero-downtime fallback SQLite database.", e)
    engine = create_db_engine(FALLBACK_SQLITE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initializes schema and tables if they do not exist."""
    try:
        Base.metadata.create_all(bind=engine)
        print("[AquaVision DB] Database tables verified and initialized successfully.")
        logger.info("AquaVision database tables verified and initialized successfully.")
    except (OperationalError, OSError) as e:
        print(f"[AquaVision DB] Failed to initialize database tables: {e}")
        logger.error("Failed to initialize database tables: %s", e)


def get_db() -> Generator[Session, None, None]:
    """FastAPI request-scoped database session dependency."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
