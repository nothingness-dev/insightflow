"""Rate-limiting throttle classes for InsightFlow.

These extend DRF's built-in throttles so the login endpoint gets a tighter
per-IP limit than general API traffic, protecting against credential stuffing
and brute-force attacks without requiring any extra infrastructure.
"""
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """5 login attempts per minute per IP address.

    Applied only to the login endpoint (LoginView.throttle_classes).
    The scope key 'login' maps to DEFAULT_THROTTLE_RATES['login'] in settings.
    """
    scope = 'login'


class AnonymousSurveyRateThrottle(AnonRateThrottle):
    """Tighter limit for public anonymous survey endpoints."""
    scope = 'anonymous_survey'


class AuthRefreshRateThrottle(ScopedRateThrottle):
    """Token refresh is the credential-guessing surface for long-lived
    refresh tokens; keep it far tighter than general traffic."""
    scope = 'auth_refresh'


class PasswordChangeRateThrottle(ScopedRateThrottle):
    """current_password is a brute-force oracle; cap guesses hard."""
    scope = 'password_change'


class ExportRateThrottle(ScopedRateThrottle):
    """CSV/Excel/PDF generation is CPU/RAM heavy; a retry loop must not be
    able to pin workers."""
    scope = 'exports'


class BulkImportRateThrottle(ScopedRateThrottle):
    """Concurrent hashing of thousands of rows; tight per-admin limit."""
    scope = 'bulk_import'
