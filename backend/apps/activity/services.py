"""Central activity-logging service.

``log_activity`` is the single entry point used across the app to record audit
events. It is intentionally defensive: logging must NEVER break the request it
is observing, so every failure is swallowed and reported to the standard logger
instead of propagating.

Security:
  * IP / user-agent are read from request meta only.
  * ``metadata`` is sanitised — any key whose name hints at a secret
    (password, token, secret, authorization, ...) is dropped, and values are
    coerced to safe JSON primitives with bounded length.
"""
import logging

from django.utils import timezone

from .models import ActivityLog, ACTION_LABELS, CRITICAL_ACTIONS

logger = logging.getLogger('apps')

# Substrings that mark a metadata key as sensitive — such keys are never stored.
_SENSITIVE_KEY_HINTS = (
    'password', 'passwd', 'pwd', 'token', 'secret', 'authorization',
    'auth', 'session', 'cookie', 'csrf', 'refresh', 'access', 'key',
)

_MAX_STR = 300
_MAX_METADATA_KEYS = 25


def _client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
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

        return ActivityLog.objects.create(
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
    except Exception:  # pragma: no cover - defensive guard
        logger.exception('Failed to record activity log for action=%s', action)
        return None
