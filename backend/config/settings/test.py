"""Test settings for InsightFlow.

Extends dev settings with overrides that make the test suite reliable:

- Disables all DRF throttles so login-heavy tests don't bleed 429 errors
  into one another through a shared throttle cache key.
- Uses LocMemCache (already the default in dev.py) — spelled out here
  explicitly so it is guaranteed even if base.py changes.
- Uses a fast password hasher so bulk-user tests run in milliseconds.
"""

from .dev import *  # noqa: F401,F403

# ── Password hashing ────────────────────────────────────────────────────────
# MD5 is intentionally insecure but orders of magnitude faster than bcrypt
# for test runs that create dozens of users.
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# ── Cache ────────────────────────────────────────────────────────────────────
# Guarantee a clean, isolated in-memory cache for every test run.
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'insightflow-test',
    }
}

# ── Throttling ───────────────────────────────────────────────────────────────
# DRF throttles are backed by the cache; because tests share a single
# LocMemCache instance, a burst of login requests in one test class trips
# the 'login' rate limit for every test that follows in the same run,
# producing spurious 429 responses.
#
# The fix: raise all limits high enough that no realistic test suite can
# hit them.  We do NOT use None (which DRF interprets differently depending
# on version), and we do NOT monkey-patch throttle classes — overriding
# DEFAULT_THROTTLE_RATES is the cleanest, settings-only solution.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # type: ignore[name-defined]  # noqa: F405  inherited from base
    'DEFAULT_THROTTLE_CLASSES': [],
    'DEFAULT_THROTTLE_RATES': {
        'anon':             '10000/minute',
        'user':             '10000/minute',
        'login':            '10000/minute',
        'anonymous_survey': '10000/minute',
    },
}
