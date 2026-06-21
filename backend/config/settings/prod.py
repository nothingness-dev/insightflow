from .base import *
from decouple import config, Csv

DEBUG = False

# FIX #15: CORS_ALLOWED_ORIGINS default was only 'http://localhost', which blocks
# all LAN clients (e.g. 192.168.1.x) on a hospital network. Include the server's
# own origin. Operators should set CORS_ALLOWED_ORIGINS in their .env to match
# the server's actual IP/hostname, e.g. "http://192.168.1.100,http://myserver.local"
CORS_ALLOWED_ORIGINS = config(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost,http://127.0.0.1',
    cast=Csv(),
)
CORS_ALLOW_CREDENTIALS = True

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

SESSION_COOKIE_SECURE = False  # Set True if using HTTPS
CSRF_COOKIE_SECURE = False      # Set True if using HTTPS

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
