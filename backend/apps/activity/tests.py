from django.test import RequestFactory, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import ActivityActions, ActivityLog
from .services import _client_ip, log_activity


class LogActivityServiceTests(APITestCase):
    def test_log_activity_creates_record_and_marks_critical(self):
        admin = User.objects.create_user(username='svc_admin', password='Pass@1234', full_name='مدیر', role='admin')
        log = log_activity(
            ActivityActions.USER_DELETE,
            actor=admin,
            target_repr='کارمند حذف‌شده',
        )
        self.assertIsNotNone(log)
        self.assertTrue(log.is_critical)
        self.assertEqual(log.actor_username, 'svc_admin')
        self.assertEqual(log.action, ActivityActions.USER_DELETE)

    def test_metadata_is_sanitised_of_secrets(self):
        log = log_activity(
            ActivityActions.LOGIN,
            description='تست',
            metadata={'password': 'super-secret', 'token': 'abc', 'count': 5, 'name': 'ok'},
        )
        self.assertNotIn('password', log.metadata)
        self.assertNotIn('token', log.metadata)
        self.assertEqual(log.metadata.get('count'), 5)
        self.assertEqual(log.metadata.get('name'), 'ok')

    def test_log_activity_never_raises(self):
                                                                            
        try:
            log_activity(ActivityActions.LOGIN, metadata={'obj': object(), 'nested': {'a': 1}})
        except Exception as exc:                    
            self.fail(f'log_activity raised: {exc}')


class ClientIPTrustTests(APITestCase):
    """Regression coverage for spoofable proxy headers (bug: clients could
    forge X-Real-IP / X-Forwarded-For to defeat vote locks, audit trails,
    and throttle buckets whenever the backend was directly reachable)."""

    def setUp(self):
        self.factory = RequestFactory()

    def _request(self, **meta):
        return self.factory.get('/', **meta)

    def test_untrusted_headers_are_ignored(self):
        request = self._request(
            REMOTE_ADDR='198.51.100.7',
            HTTP_X_REAL_IP='203.0.113.99',
            HTTP_X_FORWARDED_FOR='203.0.113.99, 10.0.0.1',
        )
        with override_settings(TRUST_PROXY_HEADERS=False):
            self.assertEqual(_client_ip(request), '198.51.100.7')

    def test_trusted_real_ip_wins(self):
        request = self._request(
            REMOTE_ADDR='172.18.0.9',
            HTTP_X_REAL_IP='203.0.113.99',
            HTTP_X_FORWARDED_FOR='203.0.113.99',
        )
        with override_settings(TRUST_PROXY_HEADERS=True):
            self.assertEqual(_client_ip(request), '203.0.113.99')

    def test_trusted_forwarded_for_uses_leftmost_valid_entry(self):
        request = self._request(
            REMOTE_ADDR='172.18.0.9',
            HTTP_X_FORWARDED_FOR='not-an-ip, 203.0.113.50',
        )
        with override_settings(TRUST_PROXY_HEADERS=True):
            self.assertEqual(_client_ip(request), '203.0.113.50')

    def test_invalid_header_values_fall_through_to_remote_addr(self):
        request = self._request(
            REMOTE_ADDR='198.51.100.7',
            HTTP_X_REAL_IP='<script>alert(1)</script>',
            HTTP_X_FORWARDED_FOR='garbage',
        )
        with override_settings(TRUST_PROXY_HEADERS=True):
            self.assertEqual(_client_ip(request), '198.51.100.7')

    def test_none_request_returns_none(self):
        self.assertIsNone(_client_ip(None))


class ActivityApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='act_admin', password='Pass@1234', full_name='مدیر فعالیت', role='admin'
        )
        self.employee = User.objects.create_user(
            username='act_emp', password='Pass@1234', full_name='کارمند', role='employee'
        )

    def _seed(self, n=30):
        ActivityLog.objects.bulk_create([
            ActivityLog(
                action=ActivityActions.LOGIN,
                actor=self.admin,
                actor_username=self.admin.username,
                actor_full_name=self.admin.full_name,
                actor_role='admin',
                description=f'ورود {i}',
                created_at=timezone.now(),
            )
            for i in range(n)
        ])

    def test_logs_endpoint_requires_admin(self):
        self.client.force_authenticate(self.employee)
        res = self.client.get('/api/admin/activity/logs/')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_logs_are_server_side_paginated(self):
        self._seed(55)
        self.client.force_authenticate(self.admin)
        res = self.client.get('/api/admin/activity/logs/?page_size=20')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 55)
        self.assertEqual(len(res.data['results']), 20)
        self.assertIsNotNone(res.data['next'])

    def test_logs_search_and_action_filter(self):
        self._seed(5)
        log_activity(ActivityActions.SURVEY_DELETE, actor=self.admin, target_repr='نظرسنجی ویژه')
        self.client.force_authenticate(self.admin)
        res = self.client.get('/api/admin/activity/logs/?action=survey_delete')
        self.assertEqual(res.data['count'], 1)
        res2 = self.client.get('/api/admin/activity/logs/?search=ویژه')
        self.assertEqual(res2.data['count'], 1)

    def test_stats_endpoint(self):
        self._seed(10)
        self.client.force_authenticate(self.admin)
        res = self.client.get('/api/admin/activity/stats/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['total_activities'], 10)
        self.assertEqual(res.data['today_activities'], 10)
        self.assertEqual(res.data['most_active_admin']['username'], 'act_admin')

    def test_login_records_activity(self):
        res = self.client.post('/api/auth/login/', {'username': 'act_admin', 'password': 'Pass@1234'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(ActivityLog.objects.filter(action=ActivityActions.LOGIN, actor=self.admin).exists())

    def test_failed_login_records_critical_activity(self):
        res = self.client.post('/api/auth/login/', {'username': 'act_admin', 'password': 'wrong'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        log = ActivityLog.objects.filter(action=ActivityActions.LOGIN_FAILED).first()
        self.assertIsNotNone(log)
        self.assertTrue(log.is_critical)
        self.assertEqual(log.status, ActivityLog.STATUS_FAILED)

    def test_export_defaults_to_last_30_days_when_no_dates(self):
                                                                              
                                                          
        self._seed(3)
        self.client.force_authenticate(self.admin)
        res = self.client.get('/api/admin/activity/export/?export_format=csv')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', res['Content-Type'])

    def test_export_csv_within_range(self):
        self._seed(3)
        self.client.force_authenticate(self.admin)
        today = timezone.localtime().date().isoformat()
        res = self.client.get(f'/api/admin/activity/export/?export_format=csv&date_from={today}&date_to={today}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('text/csv', res['Content-Type'])
        self.assertIn('attachment', res['Content-Disposition'])


class DailyChartAggregationTests(APITestCase):
    """The daily buckets must be aggregated in the database and match the
    previous row-by-row local-date bucketing exactly."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='chart_admin', password='Pass@1234', full_name='مدیر', role='admin')

    def test_daily_buckets_count_total_and_failed(self):
        from django.utils import timezone
        import datetime as dt
        now = timezone.localtime()
        today_midnight = now.replace(hour=12, minute=0, second=0, microsecond=0)
        yesterday_noon = (now - dt.timedelta(days=1)).replace(hour=12, minute=0,
                                                              second=0, microsecond=0)
        ActivityLog.objects.create(action=ActivityActions.LOGIN, actor=self.admin,
                                   actor_username=self.admin.username, created_at=today_midnight)
        ActivityLog.objects.create(action=ActivityActions.LOGIN, actor=self.admin,
                                   actor_username=self.admin.username, created_at=today_midnight)
        ActivityLog.objects.create(action=ActivityActions.LOGIN_FAILED, actor=None,
                                   actor_username='nope', status=ActivityLog.STATUS_FAILED,
                                   created_at=yesterday_noon)

        self.client.force_authenticate(self.admin)
        response = self.client.get('/api/admin/activity/charts/?days=7')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        daily = {b['date']: b for b in response.data['daily']}
        self.assertEqual(len(response.data['daily']), 7)
        today_key = today_midnight.date().isoformat()
        yesterday_key = yesterday_noon.date().isoformat()
        self.assertEqual(daily[today_key]['total'], 2)
        self.assertEqual(daily[today_key]['failed'], 0)
        self.assertEqual(daily[yesterday_key]['total'], 1)
        self.assertEqual(daily[yesterday_key]['failed'], 1)

        empty_days = [b for b in response.data['daily'] if b['total'] == 0]
        for bucket in empty_days:
            self.assertEqual(bucket['failed'], 0)
