from pathlib import Path
from decouple import config, Csv
import dj_database_url
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',

    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'apps.accounts',
    'apps.surveys',
    'apps.activity',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.core.middleware.ContentSecurityPolicyMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': dj_database_url.config(
        default=config('DATABASE_URL', default='sqlite:///db.sqlite3'),
        conn_max_age=600
    )
}

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'apps.accounts.password_validators.PersianUserAttributeSimilarityValidator',
    },
    {
        'NAME': 'apps.accounts.password_validators.PersianMinimumLengthValidator',
        'OPTIONS': {'min_length': 12},
    },
    {
        'NAME': 'apps.accounts.password_validators.PersianCommonPasswordValidator',
    },
    {
        'NAME': 'apps.accounts.password_validators.PersianNumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'fa-ir'
TIME_ZONE = 'Asia/Tehran'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Only enable behind a reverse proxy that overwrites X-Real-IP /
# X-Forwarded-For from socket-level data (the bundled nginx does). Off by
# default so a directly exposed backend can never have client IPs — and
# therefore anonymous-vote locks, audit entries, or throttle buckets —
# forged through spoofed headers.
TRUST_PROXY_HEADERS = config('TRUST_PROXY_HEADERS', default=False, cast=bool)

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],

    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon':  '60/minute',
        'user':  '300/minute',
        'login': '5/minute',
        'anonymous_survey': '30/minute',
    },
}

# Pin DRF throttle identity to the same trust policy as _client_ip():
# 1 trusted proxy (use the header value nginx wrote), or none at all
# (always REMOTE_ADDR) so forged X-Forwarded-For cannot rotate buckets.
REST_FRAMEWORK['NUM_PROXIES'] = 1 if TRUST_PROXY_HEADERS else 0

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,

    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

MAX_UPLOAD_SIZE = config('MAX_UPLOAD_SIZE', default=2097152, cast=int)
ALLOWED_UPLOAD_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

REDIS_URL = config('REDIS_URL', default='redis://redis:6379/0')

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': REDIS_URL,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',

            'IGNORE_EXCEPTIONS': True,
        },
        'KEY_PREFIX': 'InsightFlow',
        'TIMEOUT': 60 * 5,
    }
}

CACHE_TTL_DASHBOARD       = 60 * 2
CACHE_TTL_SURVEY_RESULTS  = 60 * 5
CACHE_TTL_ACTIVITY_STATS  = 60 * 2
CACHE_TTL_ACTIVITY_CHARTS = 60 * 10
CACHE_TTL_FILTER_OPTIONS  = 60 * 30
CACHE_TTL_EMPLOYEE_LIST   = 60 * 2

# Only honor X-Forwarded-Host / X-Forwarded-Proto when the proxy chain is
# trusted (same policy as client-IP resolution); otherwise a caller could
# influence host/URL building through forged headers.
USE_X_FORWARDED_HOST = TRUST_PROXY_HEADERS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if TRUST_PROXY_HEADERS else None

CONTENT_SECURITY_POLICY = config(
    'CONTENT_SECURITY_POLICY',
    default=(
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
)
