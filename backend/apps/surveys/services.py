from collections import defaultdict

from django.db import transaction
from django.db.models import Sum, Count, Avg, F, Q
from .models import Survey, SurveyQuestion, SurveyPerson, Rating


def _photo_url_for(person, request=None):
    if not person.photo:
        return None
    if request:
        return request.build_absolute_uri(person.photo.url)
    return person.photo.url


def _comment_payload(rating):
    return {
        'question_id': rating.question_id,
        'question_text': rating.question.text,
        'comment': rating.comment,
    }


def calculate_survey_results(survey, request=None):
    """Calculate anonymous multi-question survey results.

    Only votes from voters who have fully completed the survey (answered every
    active question for every active person) are counted.  Partial voters are
    excluded from all aggregates and comments so that incomplete submissions do
    not skew averages or expose identifiable partial data.
    """
    people = list(survey.people.filter(is_active=True).order_by('display_order', 'created_at'))
    questions = list(survey.questions.filter(is_active=True).order_by('display_order', 'created_at'))

    active_people_count = len(people)
    active_questions_count = len(questions)
    required_answers = active_people_count * active_questions_count

    # ── find voters who answered every active person × every active question ──
    if required_answers > 0:
        completed_voter_ids = list(
            Rating.objects
            .filter(
                survey=survey,
                person__is_active=True,
                question__is_active=True,
            )
            .values('voter_id')
            .annotate(answered_count=Count('id', distinct=True))
            .filter(answered_count=required_answers)
            .values_list('voter_id', flat=True)
        )
    else:
        completed_voter_ids = []

    # All subsequent queries are scoped to completed voters only
    base_qs = Rating.objects.filter(
        survey=survey,
        person__is_active=True,
        question__is_active=True,
        voter_id__in=completed_voter_ids,
    )

    scored_aggregates = {
        row['person_id']: row
        for row in base_qs
        .filter(score__isnull=False)
        .values('person_id')
        .annotate(
            total=Sum('score'),
            score_count=Count('id'),
            avg=Avg('score'),
            voters_count=Count('voter_id', distinct=True),
        )
    }

    question_aggregates = {
        (row['person_id'], row['question_id']): row
        for row in base_qs
        .filter(score__isnull=False)
        .values('person_id', 'question_id')
        .annotate(
            total=Sum('score'),
            score_count=Count('id'),
            avg=Avg('score'),
            voters_count=Count('voter_id', distinct=True),
        )
    }

    voter_counts = {
        row['person_id']: row['voters_count']
        for row in base_qs
        .values('person_id')
        .annotate(voters_count=Count('voter_id', distinct=True))
    }

    comments_by_person = defaultdict(list)
    comments_by_person_question = defaultdict(list)
    comment_rows = (
        base_qs
        .exclude(comment__isnull=True)
        .exclude(comment__exact='')
        .select_related('question')
        .order_by('person_id', 'question__display_order', 'created_at')
    )
    for rating in comment_rows:
        payload = _comment_payload(rating)
        comments_by_person[rating.person_id].append(payload)
        comments_by_person_question[(rating.person_id, rating.question_id)].append(rating.comment)

    results = []
    for person in people:
        person_score_agg = scored_aggregates.get(person.id, {})
        question_results = []

        for question in questions:
            q_agg = question_aggregates.get((person.id, question.id), {})
            question_results.append({
                'question_id': question.id,
                'question_text': question.text,
                'has_score': question.has_score,
                'score_required': question.score_required,
                'has_comment': question.has_comment,
                'comment_required': question.comment_required,
                'average_score': round(q_agg['avg'], 2) if q_agg.get('avg') is not None else None,
                'total_score': q_agg.get('total') or 0,
                'responses_count': q_agg.get('score_count') or 0,
                'votes_count': q_agg.get('voters_count') or 0,
                'comments': comments_by_person_question.get((person.id, question.id), []),
            })

        results.append({
            'person_id': person.id,
            'full_name': person.full_name,
            'photo_url': _photo_url_for(person, request),
            'department': person.department,
            'role_title': person.role_title,
            'average_score': round(person_score_agg['avg'], 2) if person_score_agg.get('avg') is not None else None,
            'total_score': person_score_agg.get('total') or 0,
            'votes_count': voter_counts.get(person.id, 0),
            'scored_answers_count': person_score_agg.get('score_count') or 0,
            'comments': comments_by_person.get(person.id, []),
            'question_results': question_results,
            'display_order': person.display_order,
        })

    results.sort(key=lambda x: (
        -(x['average_score'] if x['average_score'] is not None else -1),
        -(x['votes_count']),
        -(x['total_score']),
        x['display_order']
    ))

    for i, r in enumerate(results, 1):
        r['rank'] = i
        del r['display_order']

    return results


def duplicate_survey(source_survey, created_by):
    """Create a draft survey clone with copied questions, people and no responses."""
    title_prefix = 'کپی - '
    cloned_title = f'{title_prefix}{source_survey.title}'
    max_title_length = Survey._meta.get_field('title').max_length

    if len(cloned_title) > max_title_length:
        cloned_title = f'{title_prefix}{source_survey.title[:max_title_length - len(title_prefix)]}'

    with transaction.atomic():
        duplicate = Survey.objects.create(
            title=cloned_title,
            question=source_survey.question,
            description=source_survey.description,
            status=Survey.STATUS_DRAFT,
            results_visibility=source_survey.results_visibility,
            created_by=created_by,
        )

        source_questions = source_survey.questions.all().order_by('display_order', 'created_at')
        SurveyQuestion.objects.bulk_create([
            SurveyQuestion(
                survey=duplicate,
                text=question.text,
                help_text=question.help_text,
                has_score=question.has_score,
                score_required=question.score_required,
                has_comment=question.has_comment,
                comment_required=question.comment_required,
                display_order=question.display_order,
                is_active=question.is_active,
            )
            for question in source_questions
        ])

        source_people = source_survey.people.all().order_by('display_order', 'created_at')
        SurveyPerson.objects.bulk_create([
            SurveyPerson(
                survey=duplicate,
                full_name=person.full_name,
                photo=person.photo.name if person.photo else None,
                role_title=person.role_title,
                department=person.department,
                description=person.description,
                display_order=person.display_order,
                is_active=person.is_active,
            )
            for person in source_people
        ])

    return duplicate


def validate_question_answers(questions, submitted_answers):
    """Validate that one non-empty answer exists for every active question."""
    questions_by_id = {question.id: question for question in questions}
    answers_by_question = {}

    for answer in submitted_answers:
        question_id = answer.get('question_id')
        if question_id not in questions_by_id:
            raise ValueError('پاسخ ارسال‌شده برای یکی از سوال‌ها معتبر نیست.')
        if question_id in answers_by_question:
            raise ValueError('برای هر سوال فقط یک پاسخ مجاز است.')
        answers_by_question[question_id] = answer

    missing_ids = set(questions_by_id.keys()) - set(answers_by_question.keys())
    if missing_ids:
        raise ValueError('باید به تمام سوال‌های این فرد پاسخ دهید.')

    validated = []
    for question in questions:
        answer = answers_by_question[question.id]
        score = answer.get('score')
        comment = (answer.get('comment') or '').strip()

        if not question.has_score:
            score = None
        elif question.score_required and score is None:
            raise ValueError('ثبت امتیاز برای یکی از سوال‌ها الزامی است.')

        if not question.has_comment:
            comment = ''
        elif question.comment_required and not comment:
            raise ValueError('ثبت توضیح برای یکی از سوال‌ها الزامی است.')

        # Even when both controls are optional, the question itself may not be
        # empty. At least one enabled answer field must contain data.
        enabled_has_value = False
        if question.has_score and score is not None:
            enabled_has_value = True
        if question.has_comment and comment:
            enabled_has_value = True
        if not enabled_has_value:
            raise ValueError('هیچ سوالی نباید بدون پاسخ بماند.')

        validated.append({
            'question': question,
            'score': score,
            'comment': comment or None,
        })

    return validated


def calculate_survey_progress():
    """
    Build progress data for every survey without per-survey database queries.

    Every active employee is treated as an implicit participant once a survey
    has been published or closed. A participant is complete only after saving
    an answer row for every active person × active question in that survey.
    """
    from apps.accounts.models import User

    active_employees = list(
        User.objects
        .filter(role='employee', is_active=True)
        .order_by('full_name', 'username', 'id')
        .values('id', 'username', 'full_name')
    )

    surveys = list(
        Survey.objects
        .annotate(
            active_people_count=Count('people', filter=Q(people__is_active=True), distinct=True),
            active_questions_count=Count('questions', filter=Q(questions__is_active=True), distinct=True),
        )
        .order_by('-created_at')
        .values('id', 'title', 'status', 'active_people_count', 'active_questions_count')
    )

    tracked_survey_ids = [
        survey['id']
        for survey in surveys
        if survey['status'] != Survey.STATUS_DRAFT
        and survey['active_people_count'] > 0
        and survey['active_questions_count'] > 0
    ]

    answered_questions_by_employee = (
        Rating.objects
        .filter(
            survey_id__in=tracked_survey_ids,
            voter__role='employee',
            voter__is_active=True,
            person__is_active=True,
            question__is_active=True,
            person__survey_id=F('survey_id'),
            question__survey_id=F('survey_id'),
        )
        .values('survey_id', 'voter_id')
        .annotate(answered_count=Count('id', distinct=True))
    )

    required_answers_by_survey = {
        survey['id']: survey['active_people_count'] * survey['active_questions_count']
        for survey in surveys
    }
    completed_employee_ids_by_survey = defaultdict(set)

    for row in answered_questions_by_employee:
        required_answers = required_answers_by_survey.get(row['survey_id'], 0)
        if required_answers and row['answered_count'] == required_answers:
            completed_employee_ids_by_survey[row['survey_id']].add(row['voter_id'])

    employee_count = len(active_employees)
    progress_items = []

    for survey in surveys:
        tracking_enabled = (
            survey['status'] != Survey.STATUS_DRAFT
            and survey['active_people_count'] > 0
            and survey['active_questions_count'] > 0
        )
        completed_ids = (
            completed_employee_ids_by_survey.get(survey['id'], set())
            if tracking_enabled
            else set()
        )
        assigned_employees = employee_count if tracking_enabled else 0
        completed_employees = len(completed_ids)
        pending_users = (
            [employee for employee in active_employees if employee['id'] not in completed_ids]
            if tracking_enabled
            else []
        )
        pending_employees = len(pending_users)
        completion_percentage = (
            round((completed_employees / assigned_employees) * 100, 1)
            if assigned_employees
            else 0.0
        )

        progress_items.append({
            'survey_id': survey['id'],
            'title': survey['title'],
            'status': survey['status'],
            'active_people_count': survey['active_people_count'],
            'active_questions_count': survey['active_questions_count'],
            'tracking_enabled': tracking_enabled,
            'assigned_employees': assigned_employees,
            'completed_employees': completed_employees,
            'pending_employees': pending_employees,
            'completion_percentage': completion_percentage,
            'pending_users': pending_users,
        })

    total_assigned_responses = sum(item['assigned_employees'] for item in progress_items)
    total_completed_responses = sum(item['completed_employees'] for item in progress_items)
    total_pending_responses = sum(item['pending_employees'] for item in progress_items)

    return {
        'summary': {
            'total_surveys': len(progress_items),
            'total_assigned_responses': total_assigned_responses,
            'total_completed_responses': total_completed_responses,
            'total_pending_responses': total_pending_responses,
            'overall_completion_percentage': (
                round((total_completed_responses / total_assigned_responses) * 100, 1)
                if total_assigned_responses
                else 0.0
            ),
        },
        'surveys': progress_items,
    }
