from django.test import TestCase
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from datetime import timedelta
from apps.accounts.models import User
from apps.activity.models import ActivityActions, ActivityLog
from apps.surveys.models import (
    AnonymousParticipation, Rating, Survey, SurveyHashLink,
    SurveyQuestion, SurveyPerson,
)
from apps.surveys.services import calculate_survey_progress, calculate_survey_results


class PerPersonQuestionAssignmentTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='assignment_admin')
        self.employee = create_employee(username='assignment_employee')
        self.survey = create_survey(self.admin, status=Survey.STATUS_DRAFT)
        self.q1 = self.survey.questions.get()
        self.all_person = create_person(self.survey, full_name='فرد کامل')
        self.custom_person = create_person(self.survey, full_name='فرد اختصاصی')

    def _custom_question_payload(self, text='سوال اختصاصی'):
        return {
            'questions': [{
                'text': text, 'help_text': '', 'has_score': True, 'score_required': True,
                'has_comment': False, 'comment_required': False,
                'has_emoji': False, 'emoji_required': False, 'display_order': 0, 'is_active': True,
            }],
        }

    def test_admin_assignment_controls_public_questions_and_rating(self):
        self.client.force_authenticate(self.admin)
        response = self.client.put(
            f'/api/admin/people/{self.custom_person.id}/questions/',
            self._custom_question_payload(), format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['uses_default_questions'])
        custom_question_id = response.data['question_ids'][0]
        self.assertEqual(response.data['question_ids'], [custom_question_id])

        self.survey.status = Survey.STATUS_PUBLISHED
        self.survey.save(update_fields=['status'])
        self.client.force_authenticate(self.employee)
        detail = self.client.get(f'/api/surveys/{self.survey.id}/')
        person_data = next(p for p in detail.data['people'] if p['id'] == self.custom_person.id)
        self.assertEqual(person_data['question_ids'], [custom_question_id])

        rated = self.client.post(
            f'/api/surveys/{self.survey.id}/people/{self.custom_person.id}/rate/',
            {'answers': [{'question_id': custom_question_id, 'score': 8}]}, format='json',
        )
        self.assertEqual(rated.status_code, status.HTTP_201_CREATED)

    def test_results_and_csv_separate_each_partial_person(self):
        SurveyQuestion.objects.create(
            survey=self.survey, person=self.custom_person, text='سوال اختصاصی',
            has_score=True, score_required=True, display_order=0,
        )
        self.custom_person.uses_default_questions = False
        self.custom_person.save(update_fields=['uses_default_questions'])

        results = calculate_survey_results(self.survey)
        by_person = {row['person_id']: row for row in results}
        # A person on the shared/default question set stays in the general
        # comparison, unaffected by another person's private questions.
        self.assertEqual(by_person[self.all_person.id]['result_section'], 'all')
        self.assertEqual(by_person[self.custom_person.id]['result_section'], 'custom:%s' % self.custom_person.id)

        self.client.force_authenticate(self.admin)
        csv_response = self.client.get(f'/api/admin/surveys/{self.survey.id}/export/csv/')
        self.assertEqual(csv_response.status_code, status.HTTP_200_OK)
        body = csv_response.content.decode('utf-8-sig')
        # The particular person gets their own clearly separated section,
        # never mixed into the general comparison table.
        self.assertIn(f'بخش اختصاصی: {self.custom_person.full_name}', body)
        self.assertNotIn(f'بخش اختصاصی: {self.all_person.full_name}', body)

    def test_person_can_be_reset_to_default_questions(self):
        self.client.force_authenticate(self.admin)
        self.client.put(
            f'/api/admin/people/{self.custom_person.id}/questions/',
            self._custom_question_payload(), format='json',
        )

        response = self.client.put(
            f'/api/admin/people/{self.custom_person.id}/questions/',
            {'use_default_questions': True}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.custom_person.refresh_from_db()
        self.assertTrue(self.custom_person.uses_default_questions)
        self.assertEqual(list(self.custom_person.custom_questions.all()), [])
        # Back on defaults, this person tracks the shared question set - just q1.
        self.assertEqual(response.data['question_ids'], [self.q1.id])


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
    survey = Survey.objects.create(
        title=kwargs.get('title', 'نظرسنجی تست'),
        question=kwargs.get('question', 'عملکرد این فرد را ارزیابی کنید'),
        created_by=created_by,
        status=status,
    )
    if kwargs.get('with_question', True):
        SurveyQuestion.objects.create(
            survey=survey,
            text=survey.question,
            has_score=True,
            score_required=True,
            display_order=0,
        )
    return survey


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


class AnonymousHashLinkParticipationTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_hash_ip')
        self.survey = create_survey(self.admin, status=Survey.STATUS_PUBLISHED, with_question=False)
        self.person = create_person(self.survey)
        self.question = SurveyQuestion.objects.create(
            survey=self.survey,
            text='Anonymous score?',
            has_score=True,
            score_required=True,
            display_order=0,
        )
        self.link = SurveyHashLink.objects.create(survey=self.survey, label='public')
        self.url = f'/api/s/{self.link.token}/people/{self.person.id}/rate/'

    def submit(self, anonymous_token, ip='203.0.113.10'):
        return self.client.post(
            self.url,
            {
                'anonymous_token': anonymous_token,
                'answers': [{'question_id': self.question.id, 'score': 8}],
            },
            format='json',
            HTTP_X_REAL_IP=ip,
        )

    def test_completed_anonymous_hash_link_is_locked_by_ip_and_audited(self):
        first = self.submit('anon-token-1')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(AnonymousParticipation.objects.filter(
            survey=self.survey,
            hash_link=self.link,
            ip_address='203.0.113.10',
        ).exists())

        self.link.refresh_from_db()
        self.assertEqual(self.link.anonymous_participant_count, 1)
        audit = ActivityLog.objects.get(action=ActivityActions.ANONYMOUS_VOTE)
        self.assertEqual(audit.ip_address, '203.0.113.10')
        self.assertEqual(audit.metadata['anonymous_ip'], '203.0.113.10')

        second = self.submit('anon-token-2')
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(AnonymousParticipation.objects.count(), 1)
        self.assertEqual(
            Rating.objects.filter(survey=self.survey).count(),
            1,
            'Rejected duplicate-IP submissions must not leave orphaned answers.',
        )

    def test_anonymous_my_ratings_reports_ip_locked_completion(self):
        self.submit('anon-token-1')

        response = self.client.get(
            f'/api/s/{self.link.token}/surveys/{self.survey.id}/my-ratings/',
            {'anonymous_token': 'fresh-tab-token'},
            HTTP_X_REAL_IP='203.0.113.10',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_complete'])
        self.assertTrue(response.data['ip_locked'])
        self.assertEqual(response.data['rated_person_ids'], [self.person.id])


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
            Rating.objects.create(
                survey=self.survey,
                person=self.p1,
                question=self.survey.questions.first(),
                voter=employees[i],
                score=score,
            )
        for i, score in enumerate([5, 6]):
            Rating.objects.create(
                survey=self.survey,
                person=self.p2,
                question=self.survey.questions.first(),
                voter=employees[i],
                score=score,
            )

    def get_admin_token(self):
        res = self.client.post('/api/auth/login/', {'username': 'admin_res', 'password': 'AdminPass@1'})
        return res.data['access']

    def test_results_sorted_by_average(self):
        token = self.get_admin_token()
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        res = self.client.get(f'/api/admin/surveys/{self.survey.id}/results/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data['results']
        self.assertEqual(results[0]['full_name'], self.p1.full_name)
        self.assertEqual(results[0]['rank'], 1)
        self.assertAlmostEqual(results[0]['average_score'], 8.5)

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
        self.question = SurveyQuestion.objects.create(
            survey=self.survey,
            text=self.survey.question,
            has_score=True,
            score_required=True,
            has_comment=True,
            display_order=0,
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
            question=self.question,
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
            question=self.published_survey.questions.first(),
            voter=self.completed_employee,
            score=8,
        )
        Rating.objects.create(
            survey=self.published_survey,
            person=self.second_person,
            question=self.published_survey.questions.first(),
            voter=self.completed_employee,
            score=9,
        )
        Rating.objects.create(
            survey=self.published_survey,
            person=self.first_person,
            question=self.published_survey.questions.first(),
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
        self.assertIsNotNone(published_progress['last_employee_response_at'])
        self.assertIsNone(published_progress['last_anonymous_response_at'])
        self.assertEqual(
            published_progress['last_response_at'],
            published_progress['last_employee_response_at'],
        )
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

    def test_admin_progress_reports_anonymous_response_time_separately(self):
        link = SurveyHashLink.objects.create(
            survey=self.published_survey,
            label='progress public link',
            anonymous_participant_count=1,
        )
        participation = AnonymousParticipation.objects.create(
            survey=self.published_survey,
            hash_link=link,
            ip_address='203.0.113.44',
            anonymous_token='progress-anonymous-token',
        )
        self.authenticate(self.admin, 'AdminPass@1')

        response = self.client.get('/api/admin/surveys/progress/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        progress = next(
            item for item in response.data['surveys']
            if item['survey_id'] == self.published_survey.id
        )
        self.assertEqual(progress['anonymous_participants'], 1)
        self.assertEqual(
            parse_datetime(progress['last_anonymous_response_at']),
            participation.completed_at,
        )
        self.assertEqual(
            progress['last_response_at'],
            progress['last_anonymous_response_at'],
        )

    def test_progress_calculation_uses_a_bounded_query_count(self):
        with self.assertNumQueries(4):
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
        self.assertEqual(result['question_results'][1]['comments_count'], 1)

class EmployeeSurveyListTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_employee_list')
        self.employee = create_employee(username='employee_list')

        self.published = create_survey(
            self.admin,
            status=Survey.STATUS_PUBLISHED,
            title='نظرسنجی قابل مشاهده',
            with_question=False,
        )
        self.closed = create_survey(
            self.admin,
            status=Survey.STATUS_CLOSED,
            title='نظرسنجی بسته قابل مشاهده',
            with_question=False,
        )
        self.draft = create_survey(
            self.admin,
            status=Survey.STATUS_DRAFT,
            title='پیش‌نویس مخفی',
            with_question=False,
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


class EmojiRatingQuestionTests(APITestCase):
    """Covers the emoji rating question type (بد/متوسط/خوب/عالی)."""

    def setUp(self):
        self.admin = create_admin(username='admin_emoji')
        self.employee = create_employee(username='employee_emoji')
        self.survey = Survey.objects.create(
            title='نظرسنجی ایموجی',
            description='تست امتیاز ایموجی',
            status=Survey.STATUS_PUBLISHED,
            created_by=self.admin,
        )
        self.person = create_person(self.survey, full_name='فرد ایموجی')
        self.emoji_question = SurveyQuestion.objects.create(
            survey=self.survey,
            text='کیفیت خدمات را ارزیابی کنید؟',
            has_score=False,
            score_required=False,
            has_comment=False,
            comment_required=False,
            has_emoji=True,
            emoji_required=True,
            display_order=0,
        )

    def authenticate(self, user, password):
        response = self.client.post('/api/auth/login/', {'username': user.username, 'password': password})
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_question_serializer_requires_at_least_one_answer_type(self):
        from apps.surveys.serializers import SurveyQuestionSerializer
        serializer = SurveyQuestionSerializer(data={
            'text': 'سوال بدون نوع پاسخ',
            'has_score': False,
            'has_comment': False,
            'has_emoji': False,
        })
        self.assertFalse(serializer.is_valid())

    def test_question_serializer_accepts_emoji_only_question(self):
        from apps.surveys.serializers import SurveyQuestionSerializer
        serializer = SurveyQuestionSerializer(data={
            'text': 'سوال فقط ایموجی',
            'has_score': False,
            'has_comment': False,
            'has_emoji': True,
            'emoji_required': True,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_employee_must_submit_emoji_rating_when_required(self):
        self.authenticate(self.employee, 'EmpPass@1')
        response = self.client.post(
            f'/api/surveys/{self.survey.id}/people/{self.person.id}/rate/',
            {'answers': [{'question_id': self.emoji_question.id}]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Rating.objects.count(), 0)

    def test_employee_can_submit_emoji_rating(self):
        self.authenticate(self.employee, 'EmpPass@1')
        response = self.client.post(
            f'/api/surveys/{self.survey.id}/people/{self.person.id}/rate/',
            {'answers': [{'question_id': self.emoji_question.id, 'emoji_rating': 'good'}]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        rating = Rating.objects.get(question=self.emoji_question)
        self.assertEqual(rating.emoji_rating, 'good')
        self.assertIsNone(rating.score)

    def test_employee_cannot_submit_invalid_emoji_choice(self):
        self.authenticate(self.employee, 'EmpPass@1')
        response = self.client.post(
            f'/api/surveys/{self.survey.id}/people/{self.person.id}/rate/',
            {'answers': [{'question_id': self.emoji_question.id, 'emoji_rating': 'amazing'}]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Rating.objects.count(), 0)

    def test_results_include_emoji_breakdown(self):
        Rating.objects.create(
            survey=self.survey,
            person=self.person,
            question=self.emoji_question,
            voter=self.employee,
            emoji_rating='excellent',
        )

        self.authenticate(self.admin, 'AdminPass@1')
        response = self.client.get(f'/api/admin/surveys/{self.survey.id}/results/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result = response.data['results'][0]
        question_result = result['question_results'][0]
        self.assertEqual(question_result['average_emoji_label'], 'عالی')
        self.assertEqual(question_result['emoji_breakdown']['excellent'], 1)


class IPResponseAuditTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='ip_audit_admin')
        self.employee = create_employee(username='ip_audit_employee')
        self.survey = create_survey(
            self.admin, status=Survey.STATUS_PUBLISHED, with_question=False,
            title='ممیزی IP',
        )
        self.person_a = create_person(self.survey, full_name='شخص الف')
        self.person_b = create_person(self.survey, full_name='شخص ب')
        self.score_question = SurveyQuestion.objects.create(
            survey=self.survey, text='کیفیت ارتباط', has_score=True,
            score_required=True, display_order=1,
        )
        self.emoji_question = SurveyQuestion.objects.create(
            survey=self.survey, text='بازخورد کلی', has_score=False,
            score_required=False, has_emoji=True, emoji_required=True,
            display_order=2,
        )
        self.text_question = SurveyQuestion.objects.create(
            survey=self.survey, text='نظر تکمیلی', has_score=False,
            score_required=False, has_comment=True, comment_required=False,
            display_order=3,
        )
        self.selected_ip = '203.0.113.25'

        Rating.objects.create(
            survey=self.survey, person=self.person_a, question=self.score_question,
            anonymous_token='submission-a', score=5, ip_address=self.selected_ip,
        )
        Rating.objects.create(
            survey=self.survey, person=self.person_a, question=self.emoji_question,
            anonymous_token='submission-a', emoji_rating=Rating.EMOJI_GOOD,
            ip_address=self.selected_ip,
        )
        Rating.objects.create(
            survey=self.survey, person=self.person_a, question=self.text_question,
            anonymous_token='submission-a', comment='پاسخ‌گو و مفید',
            ip_address=self.selected_ip,
        )
        Rating.objects.create(
            survey=self.survey, person=self.person_b, question=self.score_question,
            anonymous_token='submission-a', score=4, ip_address=self.selected_ip,
        )
        Rating.objects.create(
            survey=self.survey, person=self.person_b, question=self.text_question,
            anonymous_token='submission-a', comment='خوب بود',
            ip_address=self.selected_ip,
        )
        Rating.objects.create(
            survey=self.survey, person=self.person_a, question=self.score_question,
            voter=self.employee, score=8, ip_address='198.51.100.8',
        )

        self.other_survey = create_survey(
            self.admin, status=Survey.STATUS_PUBLISHED, title='نظرسنجی دیگر',
        )
        other_person = create_person(self.other_survey, full_name='فرد بی‌ربط')
        Rating.objects.create(
            survey=self.other_survey, person=other_person,
            question=self.other_survey.questions.get(),
            anonymous_token='other-survey', score=10, ip_address=self.selected_ip,
        )

    def authenticate_admin(self):
        self.client.force_authenticate(self.admin)

    def test_permissions_match_admin_results_access(self):
        url = f'/api/admin/surveys/{self.survey.id}/ip-audit/?ip={self.selected_ip}'
        self.client.force_authenticate(self.employee)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_audit_groups_every_answer_by_surveyed_person(self):
        self.authenticate_admin()
        response = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/',
            {'ip': self.selected_ip},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['summary']['total_answers'], 5)
        self.assertEqual(response.data['summary']['total_linked_submissions'], 1)
        self.assertEqual(response.data['summary']['total_surveyed_people'], 2)
        self.assertEqual(len(response.data['people']), 2)

        people = {
            row['surveyed_person_id']: row for row in response.data['people']
        }
        answers_a = people[self.person_a.id]['submissions'][0]['answers']
        answers_b = people[self.person_b.id]['submissions'][0]['answers']
        self.assertEqual(len(answers_a), 3)
        self.assertEqual(len(answers_b), 2)
        self.assertEqual(
            {answer['surveyed_person_id'] for answer in answers_a},
            {self.person_a.id},
        )
        self.assertEqual(
            {answer['surveyed_person_id'] for answer in answers_b},
            {self.person_b.id},
        )
        by_type = {answer['question_type']: answer for answer in answers_a}
        self.assertEqual(by_type['numeric']['numeric_score'], 5)
        self.assertEqual(by_type['emoji']['emoji_rating'], 'good')
        self.assertEqual(by_type['text']['free_text_answer'], 'پاسخ‌گو و مفید')
        self.assertFalse(any(
            answer['survey_title'] == self.other_survey.title
            for person in response.data['people']
            for submission in person['submissions']
            for answer in submission['answers']
        ))

        activity = ActivityLog.objects.get(
            action=ActivityActions.IP_RESPONSE_AUDIT_VIEW
        )
        self.assertEqual(activity.metadata['selected_ip'], self.selected_ip)
        self.assertEqual(activity.metadata['answer_count'], 5)

    def test_invalid_and_empty_ip_results_are_clear(self):
        self.authenticate_admin()
        invalid = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/', {'ip': 'not-an-ip'}
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        empty = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/',
            {'ip': '192.0.2.99'},
        )
        self.assertEqual(empty.status_code, status.HTTP_200_OK)
        self.assertEqual(empty.data['people'], [])
        self.assertEqual(empty.data['summary']['total_answers'], 0)

    def test_available_ips_are_strictly_survey_scoped(self):
        self.authenticate_admin()
        response = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/ips/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('no-store', response['Cache-Control'])
        by_ip = {row['ip_address']: row for row in response.data['ips']}
        self.assertEqual(set(by_ip), {self.selected_ip, '198.51.100.8'})
        self.assertEqual(by_ip[self.selected_ip]['response_count'], 5)
        self.assertEqual(by_ip[self.selected_ip]['surveyed_person_count'], 2)
        self.assertEqual(by_ip[self.selected_ip]['submission_count'], 1)
        self.assertEqual(response.data['pagination']['total'], 2)

    def test_ip_directory_supports_server_side_search_and_pagination(self):
        for index, ip_address in enumerate(('192.0.2.10', '192.0.2.11'), start=1):
            Rating.objects.create(
                survey=self.survey, person=self.person_a,
                question=self.score_question,
                anonymous_token=f'ip-page-{index}', score=index,
                ip_address=ip_address,
            )
        self.authenticate_admin()

        first_page = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/ips/',
            {'search': '192.0.2', 'page': 1, 'page_size': 1},
        )
        second_page = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/ips/',
            {'search': '192.0.2', 'page': 2, 'page_size': 1},
        )

        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        self.assertEqual(first_page.data['pagination']['total'], 2)
        self.assertEqual(first_page.data['pagination']['total_pages'], 2)
        self.assertTrue(first_page.data['pagination']['has_next'])
        self.assertEqual(len(first_page.data['ips']), 1)
        self.assertEqual(len(second_page.data['ips']), 1)
        self.assertNotEqual(
            first_page.data['ips'][0]['ip_address'],
            second_page.data['ips'][0]['ip_address'],
        )

    def test_audit_paginates_by_person_without_splitting_answers(self):
        person_c = create_person(self.survey, full_name='شخص ج')
        Rating.objects.create(
            survey=self.survey, person=person_c, question=self.score_question,
            anonymous_token='submission-a', score=7, ip_address=self.selected_ip,
        )
        self.authenticate_admin()

        first_page = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/',
            {'ip': self.selected_ip, 'page': 1, 'page_size': 1},
        )
        second_page = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/',
            {'ip': self.selected_ip, 'page': 2, 'page_size': 1},
        )

        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        self.assertEqual(first_page.data['summary']['total_answers'], 6)
        self.assertEqual(first_page.data['summary']['total_surveyed_people'], 3)
        self.assertEqual(first_page.data['pagination']['total'], 3)
        self.assertEqual(first_page.data['pagination']['total_pages'], 3)
        self.assertEqual(len(first_page.data['people']), 1)
        self.assertEqual(len(second_page.data['people']), 1)
        self.assertNotEqual(
            first_page.data['people'][0]['surveyed_person_id'],
            second_page.data['people'][0]['surveyed_person_id'],
        )
        # Person A's three answers stay together on one page.
        self.assertEqual(
            len(first_page.data['people'][0]['submissions'][0]['answers']), 3,
        )

    def test_pagination_and_silent_refresh_do_not_create_activity_logs(self):
        self.authenticate_admin()

        page_two = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/',
            {'ip': self.selected_ip, 'page': 2, 'page_size': 1},
        )
        silent_page_one = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/',
            {
                'ip': self.selected_ip,
                'page': 1,
                'page_size': 1,
                'record_activity': 'false',
            },
        )

        self.assertEqual(page_two.status_code, status.HTTP_200_OK)
        self.assertEqual(silent_page_one.status_code, status.HTTP_200_OK)
        self.assertFalse(
            ActivityLog.objects.filter(
                action=ActivityActions.IP_RESPONSE_AUDIT_VIEW,
            ).exists()
        )

    def test_person_pagination_ignores_cross_survey_rating_links(self):
        ghost_person = create_person(self.survey, full_name='شخص بدون پاسخ')
        Rating.objects.create(
            survey=self.other_survey,
            person=ghost_person,
            question=self.other_survey.questions.get(),
            anonymous_token='cross-survey-link',
            score=6,
            ip_address=self.selected_ip,
        )
        self.authenticate_admin()

        response = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/',
            {'ip': self.selected_ip, 'page': 1, 'page_size': 20},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(response.data['pagination']['total'], 2)
        self.assertNotIn(
            ghost_person.id,
            [person['surveyed_person_id'] for person in response.data['people']],
        )

    def test_excel_is_filtered_has_columns_and_neutralizes_formulas(self):
        dangerous_person = create_person(self.survey, full_name='=HYPERLINK("x")')
        dangerous_question = SurveyQuestion.objects.create(
            survey=self.survey, text='+SUM(1,1)', has_score=False,
            score_required=False, has_comment=True, display_order=4,
        )
        Rating.objects.create(
            survey=self.survey, person=dangerous_person, question=dangerous_question,
            anonymous_token='formula-submission', comment='@SUM(1,1)',
            ip_address=self.selected_ip,
        )
        self.authenticate_admin()
        response = self.client.get(
            f'/api/admin/surveys/{self.survey.id}/ip-audit/export/excel/',
            {'ip': self.selected_ip},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('no-store', response['Cache-Control'])
        self.assertIn(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            response['Content-Type'],
        )

        import io
        import openpyxl
        workbook = openpyxl.load_workbook(io.BytesIO(response.content))
        sheet = workbook.active
        self.assertEqual(
            [cell.value for cell in sheet[6]],
            [
                'IP address', 'submission identifier', 'submitted at',
                'surveyed person', 'question order', 'question text',
                'answer type', 'numeric score', 'emoji rating',
                'free-text answer',
            ],
        )
        rows = list(sheet.iter_rows(min_row=7, values_only=True))
        self.assertEqual(len(rows), 6)
        flattened = [value for row in rows for value in row if isinstance(value, str)]
        self.assertIn("'=HYPERLINK(\"x\")", flattened)
        self.assertIn("'+SUM(1,1)", flattened)
        self.assertIn("'@SUM(1,1)", flattened)
        self.assertNotIn('فرد بی‌ربط', flattened)

        activity = ActivityLog.objects.get(
            action=ActivityActions.IP_RESPONSE_AUDIT_EXPORT
        )
        self.assertEqual(activity.metadata['selected_ip'], self.selected_ip)
        self.assertEqual(activity.metadata['export_format'], 'excel')
