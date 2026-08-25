from unittest.mock import patch

from django.test import TestCase

from apps.core import cache as cache_module


class CacheInvalidationLoggingTests(TestCase):
    """Cache failures must be observable: a Redis outage with
    IGNORE_EXCEPTIONS=True would otherwise degrade every endpoint to
    uncached without a single trace in the logs."""

    def test_invalidation_failure_is_logged_at_warning(self):
        with self.assertLogs('apps', level='WARNING') as captured:
            with patch.object(cache_module.cache, 'delete', side_effect=Exception('redis down')):
                cache_module.invalidate_dashboard()
                cache_module.invalidate_survey_results(1)
                cache_module.invalidate_hash_links(1)

        joined = ' '.join(captured.output)
        self.assertIn('invalidate_dashboard', joined)
        self.assertIn('invalidate_survey_results', joined)
        self.assertIn('invalidate_hash_links', joined)

    def test_successful_invalidation_stays_silent(self):
        try:
            with self.assertNoLogs('apps', level='WARNING'):
                cache_module.invalidate_dashboard()
        except AssertionError:
            self.fail('Successful cache invalidation must not emit warnings.')
