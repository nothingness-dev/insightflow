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
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
