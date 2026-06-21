"""Centralised cache key registry and invalidation helpers.

All cache keys are defined here so there is a single source of truth.
Views import the key builders; write paths call the invalidation helpers.

Pattern
-------
* Read path:  ``cache.get(key)`` → hit → return early; miss → compute → ``cache.set(key, data, ttl)``
* Write path: call the appropriate ``invalidate_*`` function so the next
              read gets fresh data.

Redis is configured with ``IGNORE_EXCEPTIONS = True``, so if Redis is
unavailable every cache call is a no-op and the app degrades to its
original DB-only behaviour — no crashes, no stale data.
"""
import logging

from django.core.cache import cache

logger = logging.getLogger('apps')

# ─── Key builders ─────────────────────────────────────────────────────────────

def key_dashboard() -> str:
    return 'dashboard:stats'


def key_survey_results(survey_id: int) -> str:
    return f'survey:{survey_id}:results'


def key_activity_stats() -> str:
    return 'activity:stats'


def key_activity_charts(days: int) -> str:
    return f'activity:charts:{days}'


def key_activity_filter_options() -> str:
    return 'activity:filter_options'


def key_employee_survey_list(user_id: int) -> str:
    return f'employee:{user_id}:survey_list'


# ─── Invalidation helpers ──────────────────────────────────────────────────────

def invalidate_dashboard() -> None:
    """Call whenever the survey / user / rating counts change."""
    try:
        cache.delete(key_dashboard())
    except Exception:
        logger.debug('cache.invalidate_dashboard failed silently')


def invalidate_survey_results(survey_id: int) -> None:
    """Call whenever ratings for *survey_id* change."""
    try:
        cache.delete(key_survey_results(survey_id))
    except Exception:
        logger.debug('cache.invalidate_survey_results(%s) failed silently', survey_id)


def invalidate_activity_stats() -> None:
    """Call after any activity log is written."""
    try:
        # Stats and all chart windows share a prefix — delete by pattern.
        cache.delete(key_activity_stats())
        # Charts are keyed by day count; delete the most common windows.
        for days in (7, 14, 30, 60):
            cache.delete(key_activity_charts(days))
    except Exception:
        logger.debug('cache.invalidate_activity_stats failed silently')


def invalidate_filter_options() -> None:
    """Call when a new actor first appears in the log or action set changes."""
    try:
        cache.delete(key_activity_filter_options())
    except Exception:
        logger.debug('cache.invalidate_filter_options failed silently')


def invalidate_employee_survey_list(user_id: int) -> None:
    """Call after a rating is submitted or a survey's status/people changes."""
    try:
        cache.delete(key_employee_survey_list(user_id))
    except Exception:
        logger.debug('cache.invalidate_employee_survey_list(%s) failed silently', user_id)


def invalidate_all_employee_survey_lists() -> None:
    """Invalidate every employee's survey list (used when a survey is published/closed/deleted)."""
    try:
        # django-redis exposes delete_pattern; fall back to a no-op if unavailable.
        cache.delete_pattern('*employee:*:survey_list')  # type: ignore[attr-defined]
    except Exception:
        logger.debug('cache.invalidate_all_employee_survey_lists failed silently')
