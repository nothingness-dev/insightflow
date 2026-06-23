"""Rate-limiting throttle classes for InsightFlow.

These extend DRF's built-in throttles so the login endpoint gets a tighter
per-IP limit than general API traffic, protecting against credential stuffing
and brute-force attacks without requiring any extra infrastructure.
"""
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """5 login attempts per minute per IP address.

    Applied only to the login endpoint (LoginView.throttle_classes).
    The scope key 'login' maps to DEFAULT_THROTTLE_RATES['login'] in settings.
    """
    scope = 'login'
