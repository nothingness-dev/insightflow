   
import logging

from django.core.cache import cache

logger = logging.getLogger('apps')


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

        cache.delete(key_activity_stats())

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

        cache.delete_pattern('*employee:*:survey_list')                              
    except Exception:
        logger.debug('cache.invalidate_all_employee_survey_lists failed silently')
