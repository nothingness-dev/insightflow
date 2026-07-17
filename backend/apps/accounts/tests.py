from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase
from unittest.mock import patch
import os

from apps.accounts.models import User


class UserManagementApiTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_users',
            password='AdminPass@123',
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

    def test_weak_passwords_are_rejected_for_create_and_reset(self):
        create_response = self.client.post('/api/admin/users/', {
            'username': 'weak_password_user',
            'full_name': 'کاربر آزمایشی',
            'role': 'employee',
            'password': '1',
            'password_confirm': '1',
            'is_active': True,
        })

        self.assertEqual(create_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='weak_password_user').exists())

        created = User.objects.create_user(
            username='reset_target', full_name='کاربر آزمایشی',
            password='ExistingPass@123', role='employee',
        )

        reset_response = self.client.post(
            f'/api/admin/users/{created.id}/reset-password/',
            {'new_password': '2', 'new_password_confirm': '2'},
        )
        self.assertEqual(reset_response.status_code, status.HTTP_400_BAD_REQUEST)
        created.refresh_from_db()
        self.assertTrue(created.check_password('ExistingPass@123'))

    def test_strong_password_is_accepted_for_create(self):
        response = self.client.post('/api/admin/users/', {
            'username': 'strong_password_user',
            'full_name': 'کاربر آزمایشی',
            'role': 'employee',
            'password': 'Unique-Safe@2026',
            'password_confirm': 'Unique-Safe@2026',
            'is_active': True,
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.get(username='strong_password_user').check_password('Unique-Safe@2026'))

    def test_user_can_keep_the_same_password(self):
        response = self.client.post('/api/auth/change-password/', {
            'current_password': 'AdminPass@123',
            'new_password': 'AdminPass@123',
            'new_password_confirm': 'AdminPass@123',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
    def test_bulk_import_creates_rows_in_one_batch_response(self):
        payload = (
            '# comment\n'
            'username,نام کامل,رمز عبور,نقش\n'
            'bulk_001,کارمند اول,UniquePass@1234,employee\n'
            'bulk_002,کارمند دوم,UniquePass@5678,employee\n'
            'bulk_001,تکراری,UniquePass@1234,employee\n'
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
            f'load_{index:03d},کارمند آزمایشی {index:03d},Emp@{index:03d}Test2026,employee'
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

    def test_bulk_import_reports_weak_password_as_row_error(self):
        upload = SimpleUploadedFile(
            'weak.csv',
            'weak_bulk,کاربر ضعیف,123,employee'.encode('utf-8-sig'),
            content_type='text/csv',
        )

        response = self.client.post('/api/admin/users/bulk-import/', {'file': upload}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created_count'], 0)
        self.assertEqual(response.data['error_count'], 1)
        self.assertFalse(User.objects.filter(username='weak_bulk').exists())

    def test_bootstrap_admin_requires_configured_password(self):
        with patch.dict(os.environ, {
            'ADMIN_USERNAME': 'bootstrap_admin',
            'ADMIN_PASSWORD': '',
            'ADMIN_FULL_NAME': 'مدیر راه‌اندازی',
        }):
            with self.assertRaises(CommandError):
                call_command('create_admin_if_not_exists')

        self.assertFalse(User.objects.filter(username='bootstrap_admin').exists())
