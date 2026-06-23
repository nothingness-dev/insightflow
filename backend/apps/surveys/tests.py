from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from datetime import timedelta
from apps.accounts.models import User
from apps.surveys.models import Survey, SurveyQuestion, SurveyPerson, Rating
from apps.surveys.services import calculate_survey_progress


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

    def test_can_rate_published_survey_without_start_window(self):
        survey = create_survey(
            self.admin, status=Survey.STATUS_PUBLISHED,
        )
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 5})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_can_rate_published_survey_without_end_window(self):
        survey = create_survey(
            self.admin, status=Survey.STATUS_PUBLISHED,
        )
        person = create_person(survey)
        token = self.get_token(self.emp1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.post(f'/api/surveys/{survey.id}/people/{person.id}/rate/', {'score': 5})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

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

class SurveyDuplicateTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_duplicate')
        self.employee = create_employee(username='employee_duplicate')
        self.survey = Survey.objects.create(
            title='ارزیابی عملکرد بهار',
            question='عملکرد این فرد را ارزیابی کنید',
            description='توضیحات اصلی',
            status=Survey.STATUS_CLOSED,
            results_visibility=Survey.VISIBILITY_ADMIN_ONLY,
            created_by=self.admin,
            published_at=timezone.now(),
            closed_at=timezone.now(),
        )
        self.active_person = SurveyPerson.objects.create(
            survey=self.survey,
            full_name='علی احمدی',
            role_title='توسعه‌دهنده',
            department='فناوری',
            description='عضو تیم بک‌اند',
            display_order=2,
            is_active=True,
        )
        self.inactive_person = SurveyPerson.objects.create(
            survey=self.survey,
            full_name='سارا محمدی',
            role_title='طراح',
            department='محصول',
            description='عضو سابق تیم',
            display_order=3,
            is_active=False,
        )
        Rating.objects.create(
            survey=self.survey,
            person=self.active_person,
            voter=self.employee,
            score=9,
            comment='نظر خصوصی',
        )

    def authenticate(self, user, password):
        response = self.client.post(
            '/api/auth/login/',
            {'username': user.username, 'password': password},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_admin_can_duplicate_survey_without_copying_responses(self):
        self.authenticate(self.admin, 'AdminPass@1')

        response = self.client.post(f'/api/admin/surveys/{self.survey.id}/duplicate/')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        duplicate = Survey.objects.get(pk=response.data['id'])
        self.assertNotEqual(duplicate.id, self.survey.id)
        self.assertEqual(duplicate.title, 'کپی - ارزیابی عملکرد بهار')
        self.assertEqual(duplicate.question, self.survey.question)
        self.assertEqual(duplicate.description, self.survey.description)
        self.assertEqual(duplicate.results_visibility, self.survey.results_visibility)
        self.assertEqual(duplicate.created_by, self.admin)
        self.assertEqual(duplicate.status, Survey.STATUS_DRAFT)
        self.assertIsNone(duplicate.published_at)
        self.assertIsNone(duplicate.closed_at)
        self.assertEqual(duplicate.people.count(), 2)
        self.assertEqual(duplicate.ratings.count(), 0)

        copied_people = list(duplicate.people.order_by('display_order'))
        self.assertEqual(copied_people[0].full_name, 'علی احمدی')
        self.assertEqual(copied_people[0].role_title, 'توسعه‌دهنده')
        self.assertEqual(copied_people[0].department, 'فناوری')
        self.assertEqual(copied_people[0].description, 'عضو تیم بک‌اند')
        self.assertTrue(copied_people[0].is_active)
        self.assertFalse(copied_people[1].is_active)

    def test_employee_cannot_duplicate_survey(self):
        self.authenticate(self.employee, 'EmpPass@1')

        response = self.client.post(f'/api/admin/surveys/{self.survey.id}/duplicate/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Survey.objects.count(), 1)


class SurveyProgressTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_progress')
        self.completed_employee = create_employee(
            username='progress_complete',
            full_name='کارمند کامل',
        )
        self.partial_employee = create_employee(
            username='progress_partial',
            full_name='کارمند نیمه‌کاره',
        )
        self.pending_employee = create_employee(
            username='progress_pending',
            full_name='کارمند در انتظار',
        )
        self.inactive_employee = create_employee(
            username='progress_inactive',
            full_name='کارمند غیرفعال',
        )
        self.inactive_employee.is_active = False
        self.inactive_employee.save(update_fields=['is_active'])

        self.published_survey = create_survey(
            self.admin,
            status=Survey.STATUS_PUBLISHED,
            title='نظرسنجی پیشرفت',
        )
        self.first_person = create_person(
            self.published_survey,
            full_name='فرد اول',
        )
        self.second_person = create_person(
            self.published_survey,
            full_name='فرد دوم',
        )

        self.draft_survey = create_survey(
            self.admin,
            status=Survey.STATUS_DRAFT,
            title='نظرسنجی پیش‌نویس',
        )
        create_person(self.draft_survey, full_name='فرد پیش‌نویس')

        Rating.objects.create(
            survey=self.published_survey,
            person=self.first_person,
            voter=self.completed_employee,
            score=8,
        )
        Rating.objects.create(
            survey=self.published_survey,
            person=self.second_person,
            voter=self.completed_employee,
            score=9,
        )
        Rating.objects.create(
            survey=self.published_survey,
            person=self.first_person,
            voter=self.partial_employee,
            score=7,
        )

    def authenticate(self, user, password):
        response = self.client.post(
            '/api/auth/login/',
            {'username': user.username, 'password': password},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_admin_progress_counts_only_fully_completed_active_employee_responses(self):
        self.authenticate(self.admin, 'AdminPass@1')

        response = self.client.get('/api/admin/surveys/progress/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress_by_survey = {item['survey_id']: item for item in response.data['surveys']}
        published_progress = progress_by_survey[self.published_survey.id]
        draft_progress = progress_by_survey[self.draft_survey.id]

        self.assertEqual(published_progress['assigned_employees'], 3)
        self.assertEqual(published_progress['completed_employees'], 1)
        self.assertEqual(published_progress['pending_employees'], 2)
        self.assertEqual(published_progress['completion_percentage'], 33.3)
        self.assertTrue(published_progress['tracking_enabled'])
        self.assertEqual(
            {user['username'] for user in published_progress['pending_users']},
            {'progress_partial', 'progress_pending'},
        )

        self.assertFalse(draft_progress['tracking_enabled'])
        self.assertEqual(draft_progress['assigned_employees'], 0)
        self.assertEqual(draft_progress['completed_employees'], 0)
        self.assertEqual(draft_progress['pending_employees'], 0)
        self.assertEqual(draft_progress['pending_users'], [])

        self.assertEqual(response.data['summary']['total_surveys'], 2)
        self.assertEqual(response.data['summary']['total_assigned_responses'], 3)
        self.assertEqual(response.data['summary']['total_completed_responses'], 1)
        self.assertEqual(response.data['summary']['total_pending_responses'], 2)
        self.assertEqual(response.data['summary']['overall_completion_percentage'], 33.3)

    def test_employee_cannot_view_survey_progress(self):
        self.authenticate(self.completed_employee, 'EmpPass@1')

        response = self.client.get('/api/admin/surveys/progress/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_progress_calculation_uses_a_bounded_query_count(self):
        with self.assertNumQueries(3):
            calculate_survey_progress()


class MultiQuestionSurveyTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_multi')
        self.employee = create_employee(username='employee_multi')
        self.survey = Survey.objects.create(
            title='نظرسنجی چند سوالی',
            description='تست چند سوال',
            status=Survey.STATUS_PUBLISHED,
            created_by=self.admin,
        )
        self.person = create_person(self.survey, full_name='فرد چند سوالی')
        self.score_question = SurveyQuestion.objects.create(
            survey=self.survey,
            text='کیفیت همکاری؟',
            has_score=True,
            score_required=True,
            has_comment=False,
            comment_required=False,
            display_order=0,
        )
        self.comment_question = SurveyQuestion.objects.create(
            survey=self.survey,
            text='توضیح تکمیلی؟',
            has_score=False,
            score_required=False,
            has_comment=True,
            comment_required=True,
            display_order=1,
        )

    def authenticate(self, user, password='EmpPass@1'):
        response = self.client.post('/api/auth/login/', {'username': user.username, 'password': password})
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_employee_must_answer_every_question_for_person(self):
        self.authenticate(self.employee)
        response = self.client.post(
            f'/api/surveys/{self.survey.id}/people/{self.person.id}/rate/',
            {
                'answers': [
                    {'question_id': self.score_question.id, 'score': 8},
                ]
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Rating.objects.count(), 0)

    def test_employee_can_submit_all_question_answers_for_person(self):
        self.authenticate(self.employee)
        response = self.client.post(
            f'/api/surveys/{self.survey.id}/people/{self.person.id}/rate/',
            {
                'answers': [
                    {'question_id': self.score_question.id, 'score': 9},
                    {'question_id': self.comment_question.id, 'comment': 'همکاری خوبی دارد'},
                ]
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Rating.objects.count(), 2)
        self.assertTrue(Rating.objects.filter(question=self.score_question, score=9).exists())
        self.assertTrue(Rating.objects.filter(question=self.comment_question, comment='همکاری خوبی دارد').exists())

    def test_results_include_question_breakdown(self):
        Rating.objects.create(
            survey=self.survey,
            person=self.person,
            question=self.score_question,
            voter=self.employee,
            score=9,
        )
        Rating.objects.create(
            survey=self.survey,
            person=self.person,
            question=self.comment_question,
            voter=self.employee,
            comment='نظر ناشناس',
        )

        self.authenticate(self.admin, 'AdminPass@1')
        response = self.client.get(f'/api/admin/surveys/{self.survey.id}/results/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data['results'][0]
        self.assertEqual(result['average_score'], 9.0)
        self.assertEqual(len(result['question_results']), 2)
        self.assertEqual(result['question_results'][0]['question_text'], 'کیفیت همکاری؟')
        self.assertEqual(result['question_results'][1]['comments'], ['نظر ناشناس'])

class EmployeeSurveyListTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_employee_list')
        self.employee = create_employee(username='employee_list')

        self.published = create_survey(
            self.admin,
            status=Survey.STATUS_PUBLISHED,
            title='نظرسنجی قابل مشاهده',
        )
        self.closed = create_survey(
            self.admin,
            status=Survey.STATUS_CLOSED,
            title='نظرسنجی بسته قابل مشاهده',
        )
        self.draft = create_survey(
            self.admin,
            status=Survey.STATUS_DRAFT,
            title='پیش‌نویس مخفی',
        )

        for survey in (self.published, self.closed, self.draft):
            create_person(survey, full_name=f'فرد {survey.id}')
            SurveyQuestion.objects.create(
                survey=survey,
                text='کیفیت همکاری را ارزیابی کنید',
                has_score=True,
                score_required=True,
                display_order=0,
            )

    def test_employee_list_returns_published_and_closed_surveys(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': self.employee.username, 'password': 'EmpPass@1'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        response = self.client.get('/api/surveys/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        returned_ids = {item['id'] for item in response.data}
        self.assertEqual(returned_ids, {self.published.id, self.closed.id})
        self.assertNotIn(self.draft.id, returned_ids)
        published_item = next(item for item in response.data if item['id'] == self.published.id)
        self.assertEqual(published_item['total_people'], 1)
        self.assertEqual(published_item['total_questions'], 1)
        self.assertEqual(published_item['my_votes_count'], 0)
