from .base import *
from decouple import config, Csv

DEBUG = False

CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost,http://127.0.0.1',
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Safe on plain HTTP too: only affects which referrer leaves the page.
SECURE_REFERRER_POLICY = 'same-origin'

# TLS enforcement is opt-in so LAN/plain-HTTP deployments keep working;
# enable once the deployment serves HTTPS (directly or via a TLS proxy).
SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=False, cast=bool)
SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=0, cast=int)
if SECURE_HSTS_SECONDS:
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# These prod settings are only used by Docker Compose, where the bundled
# nginx always overwrites X-Real-IP / X-Forwarded-For from socket data.
# Default true so upgrading deployments keep real client IPs (vote locks,
# audit entries) even when their .env predates this flag; a bare-metal
# Gunicorn behind no trusted proxy must explicitly set it to false.
TRUST_PROXY_HEADERS = config('TRUST_PROXY_HEADERS', default=True, cast=bool)

SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=True, cast=bool)
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=True, cast=bool)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
        # Cache failures degrade to uncached responses silently otherwise
        # (django-redis IGNORE_EXCEPTIONS) - surface them as operational
        # warnings instead of letting a Redis outage go unnoticed.
        'django_redis': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
