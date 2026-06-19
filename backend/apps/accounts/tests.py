from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User


class UserManagementApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_users',
            password='AdminPass@1',
            full_name='مدیر کارکنان',
            role='admin',
        )
        self.client.force_authenticate(self.admin)

    def test_user_list_is_paginated_with_a_larger_management_page_size(self):
        User.objects.bulk_create([
            User(
                username=f'employee_{index:03d}',
                full_name=f'کارمند {index:03d}',
                role='employee',
                password='not-used-in-this-test',
            )
            for index in range(1, 126)
        ])

        response = self.client.get('/api/admin/users/?page=2&page_size=50')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 126)
        self.assertEqual(len(response.data['results']), 50)
        self.assertIsNotNone(response.data['previous'])
        self.assertIsNotNone(response.data['next'])

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
    def test_bulk_import_creates_rows_in_one_batch_response(self):
        payload = (
            '# comment\n'
            'username,نام کامل,رمز عبور,نقش\n'
            'bulk_001,کارمند اول,Pass@1234,employee\n'
            'bulk_002,کارمند دوم,Pass@5678,employee\n'
            'bulk_001,تکراری,Pass@1234,employee\n'
        ).encode('utf-8-sig')
        upload = SimpleUploadedFile('employees.csv', payload, content_type='text/csv')

        response = self.client.post('/api/admin/users/bulk-import/', {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created_count'], 2)
        self.assertEqual(response.data['skipped_count'], 1)
        self.assertEqual(response.data['error_count'], 0)
        self.assertTrue(User.objects.filter(username='bulk_001').exists())
        self.assertTrue(User.objects.filter(username='bulk_002').exists())

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
    def test_bulk_import_of_500_users_caps_response_details(self):
        rows = [
            f'load_{index:03d},کارمند آزمایشی {index:03d},Emp@{index:03d}Test,employee'
            for index in range(1, 501)
        ]
        upload = SimpleUploadedFile(
            'five-hundred-employees.csv',
            ('\n'.join(rows)).encode('utf-8-sig'),
            content_type='text/csv',
        )

        response = self.client.post('/api/admin/users/bulk-import/', {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created_count'], 500)
        self.assertEqual(len(response.data['created']), 100)
        self.assertEqual(response.data['created_details_omitted'], 400)
        self.assertTrue(response.data['details_truncated'])
        self.assertEqual(User.objects.filter(username__startswith='load_').count(), 500)
