from django.test import TestCase
from django.db import IntegrityError, transaction
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

    def test_excel_and_pdf_exports_remain_available(self):
        self.client.force_authenticate(self.admin)

        cases = (
            ('excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
            ('pdf', 'application/pdf'),
        )
        for export_format, content_type in cases:
            with self.subTest(export_format=export_format):
                response = self.client.get(
                    f'/api/admin/surveys/{self.survey.id}/export/{export_format}/'
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response['Content-Type'], content_type)
                self.assertGreater(len(response.content), 100)

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

    def submit(self, anonymous_token, ip='203.0.113.10', person=None):
        target = person if person is not None else self.person
        return self.client.post(
            f'/api/s/{self.link.token}/people/{target.id}/rate/',
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

    def _second_person(self):
        return SurveyPerson.objects.create(
            survey=self.survey, full_name='فرد دوم', display_order=1, is_active=True
        )

    def test_device_cannot_split_ballots_across_tokens(self):
        """Regression: a device must not rate different people under different
        anonymous tokens before completing the survey (partial-ballot loophole)."""
        second = self._second_person()

        first = self.submit('anon-token-1')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        smuggled = self.submit('anon-token-2', person=second)
        self.assertEqual(smuggled.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            Rating.objects.filter(survey=self.survey, anonymous_token='anon-token-2').exists(),
            'A second token from the same IP must not leave any ballot behind.',
        )
        self.assertEqual(AnonymousParticipation.objects.count(), 1)
        registration = AnonymousParticipation.objects.get()
        self.assertEqual(registration.anonymous_token, 'anon-token-1')

    def test_first_ballot_registers_device_and_finishes_on_completion(self):
        second = self._second_person()

        first = self.submit('anon-token-1')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.link.refresh_from_db()
        self.assertEqual(self.link.anonymous_participant_count, 1)
        registration = AnonymousParticipation.objects.get()
        self.assertIsNone(registration.finished_at, 'Half-finished session must not be marked complete.')
        self.assertFalse(ActivityLog.objects.filter(action=ActivityActions.ANONYMOUS_VOTE).exists())

        resumed = self.submit('anon-token-1', person=second)
        self.assertEqual(resumed.status_code, status.HTTP_201_CREATED)
        self.link.refresh_from_db()
        self.assertEqual(self.link.anonymous_participant_count, 1, 'Resuming must not consume a second slot.')
        registration.refresh_from_db()
        self.assertIsNotNone(registration.finished_at)
        self.assertTrue(ActivityLog.objects.filter(action=ActivityActions.ANONYMOUS_VOTE).exists())

    def test_full_capacity_blocks_new_sessions_but_not_the_bound_one(self):
        second = self._second_person()
        self.link.max_participants = 1
        self.link.save(update_fields=['max_participants'])

        first = self.submit('anon-token-1')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        resumed = self.submit('anon-token-1', person=second)
        self.assertEqual(resumed.status_code, status.HTTP_201_CREATED)

        fresh_ip = self.submit('anon-token-9', ip='198.51.100.77')
        self.assertEqual(fresh_ip.status_code, status.HTTP_403_FORBIDDEN)

    def test_detail_view_lock_semantics_for_registration_states(self):
        second = self._second_person()
        detail_url = f'/api/s/{self.link.token}/'

        fresh = self.client.get(detail_url, HTTP_X_REAL_IP='203.0.113.10')
        self.assertFalse(fresh.data['ip_locked'])

        self.submit('anon-token-1')

        bound_resume = self.client.get(
            detail_url, {'anonymous_token': 'anon-token-1'}, HTTP_X_REAL_IP='203.0.113.10',
        )
        self.assertFalse(bound_resume.data['ip_locked'])

        foreign_token = self.client.get(
            detail_url, {'anonymous_token': 'other-device'}, HTTP_X_REAL_IP='203.0.113.10',
        )
        self.assertTrue(foreign_token.data['ip_locked'])

        self.submit('anon-token-1', person=second)
        finished = self.client.get(
            detail_url, {'anonymous_token': 'anon-token-1'}, HTTP_X_REAL_IP='203.0.113.10',
        )
        self.assertTrue(finished.data['ip_locked'])

    def test_my_ratings_reports_partial_progress_for_bound_session(self):
        second = self._second_person()
        self.submit('anon-token-1')

        response = self.client.get(
            f'/api/s/{self.link.token}/surveys/{self.survey.id}/my-ratings/',
            {'anonymous_token': 'anon-token-1'},
            HTTP_X_REAL_IP='203.0.113.10',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['ip_locked'])
        self.assertFalse(response.data['is_complete'])
        self.assertEqual(response.data['rated_person_ids'], [self.person.id])

        hijack = self.client.get(
            f'/api/s/{self.link.token}/surveys/{self.survey.id}/my-ratings/',
            {'anonymous_token': 'fresh-tab-token'},
            HTTP_X_REAL_IP='203.0.113.10',
        )
        self.assertTrue(hijack.data['ip_locked'])


class CacheInvalidationAndDefaultsTests(APITestCase):
    """Regression guards for DB-save defaults and cache invalidation coverage."""

    def setUp(self):
        self.admin = create_admin(username='cache_admin')
        self.survey = create_survey(self.admin, status=Survey.STATUS_DRAFT, with_question=False)
        SurveyQuestion.objects.create(
            survey=self.survey, text='q', has_score=True,
            score_required=True, display_order=0,
        )
        login = self.client.post(
            '/api/auth/login/',
            {'username': self.admin.username, 'password': 'AdminPass@1'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_multipart_person_without_is_active_is_saved_active(self):
        from io import BytesIO

        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        buffer = BytesIO()
        Image.new('RGB', (4, 4), 'red').save(buffer, format='PNG')
        buffer.seek(0)
        response = self.client.post(
            f'/api/admin/surveys/{self.survey.id}/people/',
            {'full_name': 'فرد فعال پیش‌فرض', 'display_order': '1',
             'photo': SimpleUploadedFile('p.png', buffer.read(), content_type='image/png')},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        person = SurveyPerson.objects.get(full_name='فرد فعال پیش‌فرض')
        self.assertTrue(person.is_active, 'omitted is_active must default to active')

    def test_survey_create_refreshes_dashboard_immediately(self):
        before = self.client.get('/api/admin/dashboard/').data['stats']['total_surveys']
        response = self.client.post('/api/admin/surveys/', {
            'title': 'تازگی داشبورد', 'description': '',
            'questions': [{'text': 'q', 'has_score': True, 'score_required': True,
                           'has_comment': False, 'has_emoji': False, 'display_order': 0,
                           'is_active': True}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        after = self.client.get('/api/admin/dashboard/').data['stats']['total_surveys']
        self.assertEqual(after, before + 1, 'survey create must invalidate the dashboard cache')

    def test_anonymous_vote_invalidates_hash_links_panel_cache(self):
        SurveyPerson.objects.create(survey=self.survey, full_name='فرد لینک')
        publish = self.client.post(f'/api/admin/surveys/{self.survey.id}/publish/')
        self.assertEqual(publish.status_code, status.HTTP_200_OK, publish.content)
        link_response = self.client.post(
            f'/api/admin/surveys/{self.survey.id}/hash-links/', {'label': 'cache'}, format='json')
        token = link_response.data['token']

        primed = self.client.get(f'/api/admin/surveys/{self.survey.id}/hash-links/')
        self.assertEqual(primed.status_code, status.HTTP_200_OK)

        question = self.survey.questions.get()
        person = SurveyPerson.objects.get()
        vote = self.client.post(
            f'/api/s/{token}/people/{person.id}/rate/',
            {'anonymous_token': 'cache-check-token',
             'answers': [{'question_id': question.id, 'score': 6}]},
            format='json', HTTP_X_REAL_IP='203.0.113.44')
        self.assertEqual(vote.status_code, status.HTTP_201_CREATED, vote.content)

        fresh = self.client.get(f'/api/admin/surveys/{self.survey.id}/hash-links/')
        item = next(i for i in fresh.data if i['token'] == token)
        count = item.get('anonymous_participant_count', item.get('anonymous_participants_count', 0))
        self.assertGreaterEqual(count, 1,
                                'panel must not serve a stale participant count after a vote')


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

    def _login_employee(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': self.employee.username, 'password': 'EmpPass@1'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def _rate(self, employee_token_holder, survey, person, question, score=8):
        Rating.objects.create(
            survey=survey,
            person=person,
            question=question,
            voter=employee_token_holder,
            score=score,
        )

    def test_employee_list_reports_bulk_counters_and_custom_person_completion(self):
        """total_responses must respect per-person custom questions exactly
        like completed_participants(), and list counters must be populated."""
        custom_person = SurveyPerson.objects.create(
            survey=self.published,
            full_name='فرد اختصاصی لیست',
            display_order=5,
            is_active=True,
            uses_default_questions=False,
        )
        default_question = self.published.questions.get(person__isnull=True)
        custom_question = SurveyQuestion.objects.create(
            survey=self.published,
            person=custom_person,
            text='سوال اختصاصی فرد',
            has_score=True,
            score_required=True,
            display_order=0,
        )
        default_person = self.published.people.get(uses_default_questions=True)

        # Employee completes the whole survey: default pair + custom pair.
        self._rate(self.employee, self.published, default_person, default_question)
        self._rate(self.employee, self.published, custom_person, custom_question)
        # A second employee only answers part of it.
        partial = create_employee(username='employee_partial')
        self._rate(partial, self.published, default_person, default_question)

        self._login_employee()
        response = self.client.get('/api/surveys/')
        item = next(i for i in response.data if i['id'] == self.published.id)

        self.assertEqual(item['people_count'], 2)
        self.assertEqual(item['questions_count'], 2)
        self.assertEqual(item['total_responses'], 1, 'Only fully-completing voters count.')
        # Preserved historical list semantics: my_votes compares each person's
        # answered count against the survey-wide active question total, which
        # undercounts on mixed default/custom surveys (the survey-detail
        # endpoint is the precise source). Pinned so the bulk rewrite keeps
        # byte-identical output.
        self.assertEqual(item['my_votes_count'], 0)
        self.assertEqual(item['total_people'], 2)
        self.assertEqual(item['total_questions'], 2)
        self.assertEqual(item['anonymous_participants_count'], 0)

    def test_employee_list_query_count_does_not_scale_with_surveys(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        self._login_employee()

        def measure():
            with CaptureQueriesContext(connection) as ctx:
                response = self.client.get('/api/surveys/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            return len(ctx)

        base_count = measure()

        extra_surveys = []
        for index in range(4):
            survey = create_survey(
                self.admin,
                status=Survey.STATUS_PUBLISHED,
                title=f'نظرسنجی مقیاس {index}',
                with_question=False,
            )
            person = create_person(survey, full_name=f'فرد مقیاس {index}')
            question = SurveyQuestion.objects.create(
                survey=survey,
                text='سوال مقیاس',
                has_score=True,
                score_required=True,
                display_order=0,
            )
            self._rate(self.employee, survey, person, question)
            extra_surveys.append(survey)

        scaled_count = measure()

        self.assertLessEqual(
            scaled_count - base_count,
            3,
            'Employee list query count must stay flat as surveys grow (N+1 regression).',
        )

        response = self.client.get('/api/surveys/')
        ids = {i['id'] for i in response.data}
        for survey in extra_surveys:
            self.assertIn(survey.id, ids)
        scaled_item = next(i for i in response.data if i['id'] == extra_surveys[0].id)
        self.assertEqual(scaled_item['my_votes_count'], 1)
        self.assertEqual(scaled_item['total_responses'], 1)


class AdminSurveyListStatsTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='admin_stats')
        employee = create_employee(username='stats_employee')
        self.survey = create_survey(self.admin, status=Survey.STATUS_PUBLISHED, with_question=False)
        person = create_person(self.survey)
        question = SurveyQuestion.objects.create(
            survey=self.survey,
            text='سوال آمار',
            has_score=True,
            score_required=True,
            display_order=0,
        )
        Rating.objects.create(
            survey=self.survey, person=person, question=question,
            voter=employee, score=9,
        )
        self.link = SurveyHashLink.objects.create(survey=self.survey, label='stats')

    def test_admin_list_returns_annotated_stats_without_per_row_queries(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': self.admin.username, 'password': 'AdminPass@1'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        response = self.client.get('/api/admin/surveys/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if isinstance(response.data, dict) else response.data
        item = next(i for i in results if i['id'] == self.survey.id)
        self.assertEqual(item['people_count'], 1)
        self.assertEqual(item['questions_count'], 1)
        self.assertEqual(item['total_responses'], 1)
        self.assertEqual(item['anonymous_participants_count'], 0)


class SessionAndBooleanFixTests(APITestCase):
    """Regression guards for the session-termination, dashboard-math,
    hash-link boolean, and duplicate-invalidation fixes."""

    def setUp(self):
        self.admin = create_admin(username='fix_admin')
        self.survey = create_survey(self.admin, status=Survey.STATUS_DRAFT, with_question=False)
        SurveyQuestion.objects.create(
            survey=self.survey, text='q', has_score=True,
            score_required=True, display_order=0)
        SurveyPerson.objects.create(survey=self.survey, full_name='p1')
        SurveyPerson.objects.create(survey=self.survey, full_name='p2')

    def _admin_login(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': self.admin.username, 'password': 'AdminPass@1'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_password_reset_blacklists_target_refresh_tokens(self):
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
        employee = create_employee(username='reset_target')
        login = self.client.post(
            '/api/auth/login/',
            {'username': employee.username, 'password': 'EmpPass@1'},
        )
        old_refresh = login.data['refresh']
        self._admin_login()

        response = self.client.post(
            f'/api/admin/users/{employee.id}/reset-password/',
            {'new_password': 'BrandNew@1234', 'new_password_confirm': 'BrandNew@1234'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

        refresh_attempt = self.client.post(
            '/api/auth/refresh/', {'refresh': old_refresh}, format='json')
        self.assertEqual(refresh_attempt.status_code, status.HTTP_401_UNAUTHORIZED,
                         'stolen refresh token must die with the password reset')

    def test_dashboard_counts_completion_on_mixed_custom_surveys(self):
        custom_person = SurveyPerson.objects.create(
            survey=self.survey, full_name='custom', display_order=9,
            is_active=True, uses_default_questions=False)
        custom_question = SurveyQuestion.objects.create(
            survey=self.survey, person=custom_person, text='cq',
            has_score=True, score_required=True, display_order=0)
        default_question = self.survey.questions.get(person__isnull=True)

        employee = create_employee(username='mixed_voter')
        for default_person in self.survey.people.filter(uses_default_questions=True):
            Rating.objects.create(survey=self.survey, person=default_person,
                                  question=default_question, voter=employee, score=8)
        Rating.objects.create(survey=self.survey, person=custom_person,
                              question=custom_question, voter=employee, score=9)

        from apps.core.cache import invalidate_dashboard
        invalidate_dashboard()

        self.survey.status = Survey.STATUS_CLOSED
        self.survey.save(update_fields=['status'])
        self._admin_login()

        stats = self.client.get('/api/admin/dashboard/').data['stats']
        self.assertEqual(stats['total_responses'], 1,
                         'a fully-participating voter must be counted even '
                         'when the survey mixes default and custom questions')

    def test_hash_link_patch_with_multipart_false_stays_inactive(self):
        self._admin_login()
        self.survey.status = Survey.STATUS_PUBLISHED
        self.survey.save(update_fields=['status'])
        link_response = self.client.post(
            f'/api/admin/surveys/{self.survey.id}/hash-links/',
            {'label': 'bool'}, format='json')
        token_pk = link_response.data['id']

        response = self.client.patch(
            f'/api/admin/hash-links/{token_pk}/',
            {'is_active': 'false'},
            format='multipart',
        )
        self.assertIn(response.status_code, (status.HTTP_200_OK,))
        from apps.surveys.models import SurveyHashLink as Link
        link = Link.objects.get(pk=token_pk)
        self.assertFalse(link.is_active, "multipart string 'false' must not activate the link")

    def test_duplicate_survey_refreshes_dashboard(self):
        self._admin_login()
        before = self.client.get('/api/admin/dashboard/').data['stats']['total_surveys']
        response = self.client.post(f'/api/admin/surveys/{self.survey.id}/duplicate/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        after = self.client.get('/api/admin/dashboard/').data['stats']['total_surveys']
        self.assertEqual(after, before + 1,
                         'duplicating a survey must invalidate the dashboard cache')


class PendingPasswordEnforcementTests(APITestCase):
    """must_change_password must block API usage server-side, not just in UI."""

    def setUp(self):
        self.employee = User.objects.create_user(
            username='pending_emp', password='EmpPass@1', full_name='معلق',
            role='employee', must_change_password=True)

    def _login(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': self.employee.username, 'password': 'EmpPass@1'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def test_flagged_user_cannot_use_regular_endpoints(self):
        self._login()
        response = self.client.get('/api/surveys/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('رمز عبور', str(response.data))

    def test_change_password_stays_reachable_while_pending(self):
        self._login()
        response = self.client.post('/api/auth/change-password/', {
            'current_password': 'EmpPass@1',
            'new_password': 'Changed@4567',
            'new_password_confirm': 'Changed@4567',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.employee.refresh_from_db()
        self.assertFalse(self.employee.must_change_password)

        unlocked = self.client.get('/api/surveys/')
        self.assertEqual(unlocked.status_code, status.HTTP_200_OK,
                         'after changing the password access must be restored')


class BulkImportRobustnessTests(APITestCase):
    def setUp(self):
        self.admin = create_admin(username='import_admin')
        self._login()

    def _login(self):
        login = self.client.post(
            '/api/auth/login/',
            {'username': self.admin.username, 'password': 'AdminPass@1'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def _import(self, content):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return self.client.post(
            '/api/admin/users/bulk-import/',
            {'file': SimpleUploadedFile('users.csv', content.encode('utf-8'),
                                        content_type='text/csv')},
            format='multipart',
        )

    def test_existing_username_conflict_is_skipped_not_lost(self):
        create_employee(username='already_here')
        response = self._import(
            'username,full_name,password,role\n'
            'already_here,تکراری,Whatever@123,employee\n'
            'brand_new_row,تازه,Whatever@123,employee\n')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created_count'], 1)
        self.assertEqual(response.data['skipped_count'], 1)
        self.assertTrue(User.objects.filter(username='brand_new_row').exists(),
                        'valid rows must survive alongside conflicts')

    def test_invalid_role_is_reported_as_error_not_silently_demoted(self):
        response = self._import(
            'username,full_name,password,role\n'
            'typo_admin,مدیر تایپی,Whatever@123,adimn\n')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['created_count'], 0)
        self.assertGreaterEqual(len(response.data['errors']), 1)
        self.assertFalse(User.objects.filter(username='typo_admin').exists())


class AnonymousBallotRequiredTotalsTests(APITestCase):
    """The ballot path must keep working after switching to the constant-query
    required-total helper (same values as required_question_pairs)."""

    def setUp(self):
        self.admin = create_admin(username='ballot_admin')
        self.survey = create_survey(self.admin, status=Survey.STATUS_PUBLISHED,
                                    with_question=False)
        self.person = SurveyPerson.objects.create(survey=self.survey, full_name='p')
        self.question = SurveyQuestion.objects.create(
            survey=self.survey, text='q', has_score=True,
            score_required=True, display_order=0)
        self.link = SurveyHashLink.objects.create(survey=self.survey, label='totals')

    def test_ballot_registers_and_finishes_via_bulk_totals(self):
        response = self.client.post(
            f'/api/s/{self.link.token}/people/{self.person.id}/rate/',
            {'anonymous_token': 'totals-token',
             'answers': [{'question_id': self.question.id, 'score': 5}]},
            format='json', HTTP_X_REAL_IP='203.0.113.90')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        participation = AnonymousParticipation.objects.get(survey=self.survey)
        self.assertIsNotNone(participation.finished_at)


class PhotoUploadValidationTests(APITestCase):
    """Uploads must be validated by decoding actual bytes with Pillow, not by
    trusting client-declared extension or content-type."""

    def setUp(self):
        self.admin = create_admin(username='admin_photo')
        self.survey = create_survey(self.admin, status=Survey.STATUS_DRAFT, with_question=False)
        login = self.client.post(
            '/api/auth/login/',
            {'username': self.admin.username, 'password': 'AdminPass@1'},
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

    def _png_bytes(self, color='red'):
        from io import BytesIO
        from PIL import Image
        buffer = BytesIO()
        Image.new('RGB', (4, 4), color).save(buffer, format='PNG')
        buffer.seek(0)
        return buffer.read()

    def _jpeg_bytes(self):
        from io import BytesIO
        from PIL import Image
        buffer = BytesIO()
        Image.new('RGB', (4, 4), 'blue').save(buffer, format='JPEG')
        buffer.seek(0)
        return buffer.read()

    def _create_person_with_photo(self, uploaded_file):
        from django.core.files.uploadedfile import SimpleUploadedFile
        payload = {
            'full_name': 'فرد تصویردار',
            'role_title': 'کارشناس',
            'display_order': '1',
            'photo': uploaded_file,
        }
        return self.client.post(
            f'/api/admin/surveys/{self.survey.id}/people/',
            payload,
            format='multipart',
        )

    def test_real_png_upload_is_accepted_and_stored(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        response = self._create_person_with_photo(SimpleUploadedFile(
            'photo.png', self._png_bytes(), content_type='image/png',
        ))
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        person = SurveyPerson.objects.get(pk=response.data['id'])
        self.assertTrue(person.photo)

    def test_renamed_non_image_payload_is_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        fake = SimpleUploadedFile('photo.png', b'<html>not an image</html>', content_type='image/png')
        response = self._create_person_with_photo(fake)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(SurveyPerson.objects.filter(full_name='فرد تصویردار').exists())

    def test_extension_format_mismatch_is_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        mismatch = SimpleUploadedFile('photo.png', self._jpeg_bytes(), content_type='image/png')
        response = self._create_person_with_photo(mismatch)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_truncated_image_is_rejected(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        truncated = SimpleUploadedFile('photo.png', self._png_bytes()[:10], content_type='image/png')
        response = self._create_person_with_photo(truncated)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class QuestionRequirementInvariantTests(TestCase):
    def setUp(self):
        self.admin = create_admin(username='question_requirement_admin')
        self.survey = create_survey(
            self.admin,
            status=Survey.STATUS_DRAFT,
            with_question=False,
        )

    def test_each_single_answer_type_is_always_required(self):
        from apps.surveys.serializers import SurveyQuestionSerializer

        cases = (
            ('score', 'has_score', 'score_required'),
            ('comment', 'has_comment', 'comment_required'),
            ('emoji', 'has_emoji', 'emoji_required'),
        )
        for label, enabled_field, required_field in cases:
            with self.subTest(answer_type=label):
                payload = {
                    'text': f'سوال فقط {label}',
                    'has_score': False,
                    'score_required': True,
                    'has_comment': False,
                    'comment_required': True,
                    'has_emoji': False,
                    'emoji_required': True,
                    enabled_field: True,
                    required_field: False,
                }
                serializer = SurveyQuestionSerializer(data=payload)

                self.assertTrue(serializer.is_valid(), serializer.errors)
                self.assertTrue(serializer.validated_data[required_field])
                for field in (
                    'score_required',
                    'comment_required',
                    'emoji_required',
                ):
                    self.assertEqual(
                        serializer.validated_data[field],
                        field == required_field,
                    )

    def test_multiple_answer_types_can_remain_individually_optional(self):
        from apps.surveys.serializers import SurveyQuestionSerializer

        serializer = SurveyQuestionSerializer(data={
            'text': 'سوال ترکیبی',
            'has_score': True,
            'score_required': False,
            'has_comment': True,
            'comment_required': False,
            'has_emoji': False,
            'emoji_required': True,
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertFalse(serializer.validated_data['score_required'])
        self.assertFalse(serializer.validated_data['comment_required'])
        self.assertFalse(serializer.validated_data['emoji_required'])

    def test_database_rejects_optional_single_answer_type(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                SurveyQuestion.objects.create(
                    survey=self.survey,
                    text='امتیاز اختیاری نامعتبر',
                    has_score=True,
                    score_required=False,
                    has_comment=False,
                    comment_required=False,
                    has_emoji=False,
                    emoji_required=False,
                )


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
