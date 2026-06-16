from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from datetime import timedelta
from apps.accounts.models import User
from apps.surveys.models import Survey, SurveyPerson, Rating


def create_admin(**kwargs):
    return User.objects.create_user(
        username=kwargs.get('username', 'admin1'),
        password=kwargs.get('password', 'AdminPass@1'),
        full_name=kwargs.get('full_name', 'مدیر تست'),
        role='admin'
    )


def create_employee(**kwargs):
    return User.objects.create_user(
        username=kwargs.get('username', 'emp1'),
        password=kwargs.get('password', 'EmpPass@1'),
        full_name=kwargs.get('full_name', 'کارمند تست'),
        role='employee'
    )


def create_survey(created_by, status=Survey.STATUS_DRAFT, **kwargs):
    return Survey.objects.create(
        title=kwargs.get('title', 'نظرسنجی تست'),
        question=kwargs.get('question', 'عملکرد این فرد را ارزیابی کنید'),
        created_by=created_by,
        status=status,
    )


def create_person(survey, **kwargs):
    return SurveyPerson.objects.create(
        survey=survey,
        full_name=kwargs.get('full_name', 'علی رضایی'),
        is_active=kwargs.get('is_active', True),
    )


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.admin = create_admin()
        self.employee = create_employee()

    def test_admin_login(self):
        res = self.client.post('/api/auth/login/', {'username': 'admin1', 'password': 'AdminPass@1'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertEqual(res.data['user']['role'], 'admin')

    def test_employee_login(self):
        res = self.client.post('/api/auth/login/', {'username': 'emp1', 'password': 'EmpPass@1'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertEqual(res.data['user']['role'], 'employee')

    def test_invalid_credentials_fail(self):
        res = self.client.post('/api/auth/login/', {'username': 'admin1', 'password': 'wrongpass'})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class PermissionTests(APITestCase):
    def setUp(self):
        self.admin = create_admin()
        self.employee = create_employee()

    def get_token(self, user, password):
        res = self.client.post('/api/auth/login/', {'username': user.username, 'password': password})
        return res.data['access']

    def test_admin_can_create_survey(self):
        token = self.get_token(self.admin, 'AdminPass@1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post('/api/admin/surveys/', {
            'title': 'نظرسنجی جدید',
            'question': 'سوال اصلی',
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_employee_cannot_create_survey(self):
        token = self.get_token(self.employee, 'EmpPass@1')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post('/api/admin/surveys/', {'title': 'تست', 'question': 'سوال'})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_rate(self):
        admin = create_admin(username='adm2')
        survey = create_survey(admin, status=Survey.STATUS_PUBLISHED)
        person = create_person(survey)
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 7})
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class SurveyRatingRulesTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_r')
        self.emp1 = create_employee(username='emp_r1')
        self.emp2 = create_employee(username='emp_r2', password='EmpPass@2')

    def get_token(self, user, password='EmpPass@1'):
        res = self.client.post('/api/auth/login/', {'username': user.username, 'password': password})
        return res.data['access']

    def test_cannot_rate_draft_survey(self):
        survey = create_survey(self.admin, status=Survey.STATUS_DRAFT)
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 5})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_rate_closed_survey(self):
        survey = create_survey(self.admin, status=Survey.STATUS_CLOSED)
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 5})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_rate_before_start(self):
        survey = create_survey(
            self.admin, status=Survey.STATUS_PUBLISHED,
        )
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 5})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_rate_after_end(self):
        survey = create_survey(
            self.admin, status=Survey.STATUS_PUBLISHED,
        )
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 5})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_rate_inactive_person(self):
        survey = create_survey(self.admin, status=Survey.STATUS_PUBLISHED)
        person = create_person(survey, is_active=False)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 5})
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_rate_same_person_twice(self):
        survey = create_survey(self.admin, status=Survey.STATUS_PUBLISHED)
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res1 = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 7})
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        res2 = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 8})
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_rate_below_1(self):
        survey = create_survey(self.admin, status=Survey.STATUS_PUBLISHED)
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 0})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_rate_above_10(self):
        survey = create_survey(self.admin, status=Survey.STATUS_PUBLISHED)
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 11})
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class ResultsTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_res')
        self.survey = create_survey(self.admin, status=Survey.STATUS_CLOSED)
        self.p1 = create_person(self.survey, full_name='فرد اول')
        self.p2 = create_person(self.survey, full_name='فرد دوم')

        employees = []
        for i in range(3):
            e = User.objects.create_user(
                username=f'emp_res{i}', password='EmpPass@1',
                full_name=f'کارمند {i}', role='employee'
            )
            employees.append(e)

        # p1 gets scores 8, 9, 10 -> avg 9.0
        # p2 gets scores 5, 6 -> avg 5.5
        for i, score in enumerate([8, 9, 10]):
            Rating.objects.create(survey=self.survey, person=self.p1, voter=employees[i], score=score)
        for i, score in enumerate([5, 6]):
            Rating.objects.create(survey=self.survey, person=self.p2, voter=employees[i], score=score)

    def get_admin_token(self):
        res = self.client.post('/api/auth/login/', {'username': 'admin_res', 'password': 'AdminPass@1'})
        return res.data['access']

    def test_results_sorted_by_average(self):
        token = self.get_admin_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.get(f'/api/admin/surveys/{self.survey.id}/results/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data['results']
        self.assertEqual(results[0]['full_name'], 'فرد اول')
        self.assertEqual(results[0]['rank'], 1)
        self.assertAlmostEqual(results[0]['average_score'], 9.0)

    def test_results_do_not_expose_voter(self):
        token = self.get_admin_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.get(f'/api/admin/surveys/{self.survey.id}/results/')
        results = res.data['results']
        for r in results:
            self.assertNotIn('voter', r)
            self.assertNotIn('voter_id', r)
            self.assertNotIn('username', r)
            self.assertNotIn('ip_address', r)

    def test_results_include_required_fields(self):
        token = self.get_admin_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.get(f'/api/admin/surveys/{self.survey.id}/results/')
        r = res.data['results'][0]
        self.assertIn('average_score', r)
        self.assertIn('total_score', r)
        self.assertIn('votes_count', r)
        self.assertIn('rank', r)
