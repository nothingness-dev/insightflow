from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User

from .models import ActivityActions, ActivityLog
from .services import log_activity


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
        # Logging must never bubble an exception into the observed request.
        try:
            log_activity(ActivityActions.LOGIN, metadata={'obj': object(), 'nested': {'a': 1}})
        except Exception as exc:  # pragma: no cover
            self.fail(f'log_activity raised: {exc}')


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
        # When no date range is provided the view defaults to last 30 days
        # and still returns a valid CSV file (not a 400).
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
