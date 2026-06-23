   
import logging

from django.utils import timezone

from .models import ActivityLog, ACTION_LABELS, CRITICAL_ACTIONS
from apps.core.cache import invalidate_activity_stats, invalidate_filter_options

logger = logging.getLogger('apps')

_SENSITIVE_KEY_HINTS = (
    'password', 'passwd', 'pwd', 'token', 'secret', 'authorization',
    'auth', 'session', 'cookie', 'csrf', 'refresh', 'access', 'key',
)

_MAX_STR = 300
_MAX_METADATA_KEYS = 25


def _client_ip(request):
    """Extract the real client IP from nginx reverse-proxy headers.

    In Docker, REMOTE_ADDR is always the nginx container IP (172.x.x.x).
    nginx sets X-Real-IP to the actual client's IP via $remote_addr at the
    TCP socket level — this is the value we want.
    """
    if request is None:
        return None

    real_ip = (request.META.get('HTTP_X_REAL_IP') or '').strip()
    if real_ip:
        return real_ip

    forwarded_for = (request.META.get('HTTP_X_FORWARDED_FOR') or '').strip()
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()

    return request.META.get('REMOTE_ADDR')


def _user_agent(request):
    if request is None:
        return ''
    return (request.META.get('HTTP_USER_AGENT') or '')[:_MAX_STR]


def _sanitise_metadata(metadata):
    """Return a JSON-safe, secret-free copy of ``metadata``."""
    if not metadata or not isinstance(metadata, dict):
        return {}
    clean = {}
    for key, value in list(metadata.items())[:_MAX_METADATA_KEYS]:
        key_str = str(key)
        lowered = key_str.lower()
        if any(hint in lowered for hint in _SENSITIVE_KEY_HINTS):
            continue
        if isinstance(value, bool) or value is None:
            clean[key_str] = value
        elif isinstance(value, (int, float)):
            clean[key_str] = value
        elif isinstance(value, str):
            clean[key_str] = value[:_MAX_STR]
        elif isinstance(value, (list, tuple)):
            clean[key_str] = [str(item)[:_MAX_STR] for item in value[:20]]
        else:
            clean[key_str] = str(value)[:_MAX_STR]
    return clean


def _actor_snapshot(actor):
    if actor is None or not getattr(actor, 'is_authenticated', False):
        return {'actor': None, 'actor_username': '', 'actor_full_name': '', 'actor_role': ''}
    return {
        'actor': actor,
        'actor_username': getattr(actor, 'username', '') or '',
        'actor_full_name': getattr(actor, 'full_name', '') or '',
        'actor_role': getattr(actor, 'role', '') or '',
    }


def log_activity(
    action,
    request=None,
    actor=None,
    description=None,
    target_type='',
    target_id='',
    target_repr='',
    status=ActivityLog.STATUS_SUCCESS,
    is_critical=None,
    metadata=None,
):
    """Record an audit-log entry. Returns the created ``ActivityLog`` or ``None``.

    Never raises — a logging failure must not break the underlying action.
    """
    try:
        if actor is None and request is not None:
            request_user = getattr(request, 'user', None)
            if request_user is not None and getattr(request_user, 'is_authenticated', False):
                actor = request_user

        snapshot = _actor_snapshot(actor)

        if is_critical is None:
            is_critical = action in CRITICAL_ACTIONS

        if not description:
            label = ACTION_LABELS.get(action, action)
            description = f'{label}: {target_repr}' if target_repr else label

        entry = ActivityLog.objects.create(
            action=action,
            actor=snapshot['actor'],
            actor_username=snapshot['actor_username'],
            actor_full_name=snapshot['actor_full_name'],
            actor_role=snapshot['actor_role'],
            description=description[:500],
            target_type=str(target_type)[:40],
            target_id=str(target_id)[:40],
            target_repr=str(target_repr)[:300],
            status=status,
            is_critical=bool(is_critical),
            ip_address=_client_ip(request),
            user_agent=_user_agent(request),
            metadata=_sanitise_metadata(metadata),
            created_at=timezone.now(),
        )

        invalidate_activity_stats()

        if snapshot['actor'] is not None:
            invalidate_filter_options()
        return entry
    except Exception:                                      
        logger.exception('Failed to record activity log for action=%s', action)
        return None
