import logging
import threading
import time
from typing import Any

logger = logging.getLogger("aquavision.cache")

# 24-Hour TTL Caches (24 * 3600 = 86400 seconds)
SESSION_TTL_SECONDS = 86400
GUEST_QUOTA_TTL_SECONDS = 86400
MAX_GUEST_FREE_ENHANCEMENTS = 5

try:
    from cachetools import TTLCache  # type: ignore[import-untyped]
except ImportError:
    # Zero-dependency, thread-safe fallback TTL cache for environments without cachetools
    class TTLCache(dict):  # type: ignore[no-redef]
        """Thread-safe, zero-dependency in-memory cache with TTL and maxsize eviction."""

        def __init__(self, maxsize: int = 10000, ttl: float = 86400.0):
            super().__init__()
            self.maxsize = maxsize
            self.ttl = ttl
            self._timestamps: dict[Any, float] = {}
            self._cache_lock = threading.Lock()

        def _evict_expired(self) -> None:
            now = time.time()
            expired = [k for k, ts in list(self._timestamps.items()) if now - ts > self.ttl]
            for k in expired:
                super().pop(k, None)
                self._timestamps.pop(k, None)

        def __getitem__(self, key: Any) -> Any:
            with self._cache_lock:
                self._evict_expired()
                if key in self._timestamps:
                    if time.time() - self._timestamps[key] > self.ttl:
                        super().pop(key, None)
                        self._timestamps.pop(key, None)
                        raise KeyError(key)
                    return super().__getitem__(key)
                raise KeyError(key)

        def __setitem__(self, key: Any, value: Any) -> None:
            with self._cache_lock:
                self._evict_expired()
                if len(self) >= self.maxsize and key not in self and self._timestamps:
                    oldest_key = min(self._timestamps, key=lambda k: self._timestamps[k])
                    super().pop(oldest_key, None)
                    self._timestamps.pop(oldest_key, None)
                self._timestamps[key] = time.time()
                super().__setitem__(key, value)

        def __contains__(self, key: Any) -> bool:
            with self._cache_lock:
                self._evict_expired()
                return key in self._timestamps

        def get(self, key: Any, default: Any = None) -> Any:
            try:
                return self[key]
            except KeyError:
                return default

        def pop(self, key: Any, default: Any = None) -> Any:
            with self._cache_lock:
                self._timestamps.pop(key, None)
                return super().pop(key, default)


_lock = threading.Lock()

# In-memory fast cache layers
_session_cache: TTLCache = TTLCache(maxsize=10000, ttl=SESSION_TTL_SECONDS)
_guest_cache: TTLCache = TTLCache(maxsize=50000, ttl=GUEST_QUOTA_TTL_SECONDS)


def cache_session(token: str, user_payload: dict[str, Any]) -> None:
    """Stores validated user session in fast in-memory cache with 24-hour TTL."""
    with _lock:
        _session_cache[token] = user_payload


def get_cached_session(token: str) -> dict[str, Any] | None:
    """Retrieves session from cache if valid and within 24h activity window."""
    with _lock:
        return _session_cache.get(token)


def invalidate_session(token: str) -> None:
    """Evicts a session on logout."""
    with _lock:
        _session_cache.pop(token, None)


def get_guest_enhancement_count(guest_id: str) -> int:
    """Returns the current number of enhancements processed by this guest."""
    with _lock:
        return _guest_cache.get(guest_id, 0)


def increment_guest_enhancement_count(guest_id: str) -> int:
    """Increments guest enhancement counter and returns the new count."""
    with _lock:
        current = _guest_cache.get(guest_id, 0)
        new_count = current + 1
        _guest_cache[guest_id] = new_count
        return new_count


def set_guest_enhancement_count(guest_id: str, count: int) -> None:
    """Sets the guest enhancement counter (e.g. from database restore)."""
    with _lock:
        _guest_cache[guest_id] = count


def check_guest_quota(guest_id: str) -> tuple[bool, int, int]:
    """
    Checks if guest is allowed to enhance another image.
    Returns: (is_allowed, current_count, max_allowed)
    """
    count = get_guest_enhancement_count(guest_id)
    is_allowed = count < MAX_GUEST_FREE_ENHANCEMENTS
    return is_allowed, count, MAX_GUEST_FREE_ENHANCEMENTS
