from collections import defaultdict

from django.db import transaction
from django.db.models import Sum, Count, Avg, F, Q, Case, When, Value, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce
from .models import AnonymousParticipation, Survey, SurveyQuestion, SurveyPerson, Rating


def effective_questions_for_person(person):
    """Single source of truth for the questions assigned to a person."""
    questions = person.survey.questions.filter(is_active=True)
    if person.uses_default_questions:
        questions = questions.filter(person__isnull=True)
    else:
        questions = questions.filter(person=person)
    return questions.order_by('display_order', 'created_at')


def required_question_pairs(survey):
    return {(person.id, question.id)
            for person in survey.people.filter(is_active=True)
            for question in effective_questions_for_person(person)}


def required_question_pairs_for(people):
    """Required (person_id, question_id) pairs for a specific group of people only."""
    return {(person.id, question.id)
            for person in people
            for question in effective_questions_for_person(person)}


def completed_participants_for(survey, people):
    """Voters/anon tokens who fully answered every question for this group of
    people only. Used to isolate completion between the general/shared group
    and each particular person, so finishing one section never gates whether
    someone counts as "done" in an unrelated section."""
    people = list(people)
    required = required_question_pairs_for(people)
    if not required:
        return [], []
    person_ids = [p.id for p in people]
    answered = defaultdict(set)
    for row in Rating.objects.filter(
        survey=survey, person_id__in=person_ids, person__is_active=True, question__is_active=True,
    ).values('voter_id', 'anonymous_token', 'person_id', 'question_id'):
        key = ('voter', row['voter_id']) if row['voter_id'] is not None else ('anon', row['anonymous_token'])
        answered[key].add((row['person_id'], row['question_id']))
    voters = [value for (kind, value), pairs in answered.items() if kind == 'voter' and pairs >= required]
    anonymous = [value for (kind, value), pairs in answered.items() if kind == 'anon' and value and pairs >= required]
    return voters, anonymous


def completed_participants(survey):
    """Whole-survey completion (every active person, general and particular
    alike). Used only for participant-facing "have I finished everything
    assigned to me" tracking (progress dashboard, my_votes_count) - NOT for
    results/comments, where general and each particular person must be
    judged independently. See completed_participants_for()."""
    return completed_participants_for(survey, survey.people.filter(is_active=True))


def completed_person_ids(survey, *, voter_id=None, anonymous_token=None):
    """People fully answered by one participant, using each person's assignment."""
    filters = {'voter_id': voter_id} if voter_id is not None else {'anonymous_token': anonymous_token}
    answered = defaultdict(set)
    for person_id, question_id in Rating.objects.filter(
            survey=survey, person__is_active=True, question__is_active=True, **filters
    ).values_list('person_id', 'question_id'):
        answered[person_id].add(question_id)
    return {
        person.id for person in survey.people.filter(is_active=True)
        if answered.get(person.id, set()) >= {q.id for q in effective_questions_for_person(person)}
        and effective_questions_for_person(person).exists()
    }


EMOJI_NUMERIC_MAP = {
    Rating.EMOJI_BAD: 1,
    Rating.EMOJI_AVERAGE: 2,
    Rating.EMOJI_GOOD: 3,
    Rating.EMOJI_EXCELLENT: 4,
}

EMOJI_NUMERIC_TO_LABEL = {v: k for k, v in EMOJI_NUMERIC_MAP.items()}


def _emoji_numeric_annotation():
    return Case(
        *[When(emoji_rating=key, then=Value(value)) for key, value in EMOJI_NUMERIC_MAP.items()],
        default=None,
        output_field=IntegerField(),
    )


def emoji_label_for_numeric(value):
    if value is None:
        return None
    rounded = max(1, min(4, round(value)))
    key = EMOJI_NUMERIC_TO_LABEL[rounded]
    return dict(Rating.EMOJI_CHOICES)[key]


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


def _get_participant_key(rating):
    """Return a unique key for a participant — voter_id or 'anon:{token}'."""
    if rating.voter_id is not None:
        return ('voter', rating.voter_id)
    return ('anon', rating.anonymous_token)


def annotate_survey_list_stats(queryset):
    """Attach per-survey list counters in a fixed number of queries.

    Annotates active_people_count, active_questions_count, and
    anon_participants_total so SurveySerializer's method fields never fall
    back to per-instance queries on list endpoints.
    """
    from .models import SurveyHashLink

    anon_totals = (
        SurveyHashLink.objects
        .filter(survey=OuterRef('pk'))
        .values('survey_id')
        .annotate(total=Sum('anonymous_participant_count'))
        .values('total')[:1]
    )
    return queryset.annotate(
        active_people_count=Count('people', filter=Q(people__is_active=True), distinct=True),
        active_questions_count=Count('questions', filter=Q(questions__is_active=True), distinct=True),
        anon_participants_total=Coalesce(Subquery(anon_totals, output_field=IntegerField()), Value(0)),
    )


def _required_pair_totals(survey_ids):
    """Required (person, question) pair totals per survey id.

    Mirrors required_question_pairs(): every active person contributes their
    effective question set - the survey's active default questions for
    default-assigned people, or their own active custom questions otherwise.
    Two bounded queries replace walking people/questions per survey.
    """
    default_counts = dict(
        SurveyQuestion.objects
        .filter(survey_id__in=survey_ids, person__isnull=True, is_active=True)
        .values('survey_id')
        .annotate(total=Count('id'))
        .values_list('survey_id', 'total')
    )
    required = defaultdict(int)
    people_rows = (
        SurveyPerson.objects
        .filter(survey_id__in=survey_ids, is_active=True)
        .annotate(custom_total=Count('custom_questions', filter=Q(custom_questions__is_active=True)))
        .values('survey_id', 'uses_default_questions', 'custom_total')
    )
    for row in people_rows:
        survey_id = row['survey_id']
        if row['uses_default_questions']:
            required[survey_id] += default_counts.get(survey_id, 0)
        else:
            required[survey_id] += row['custom_total']
    return required


def bulk_completed_response_counts(survey_ids):
    """Authenticated voters who completed each survey, in three queries total.

    Mirrors completed_participants()/completed_participants_for() semantics:
    ratings are restricted to active persons and questions, and a voter
    completes a survey when their answered-pair count reaches that survey's
    required pair total. Rating rows are unique per (person, question,
    voter) pair, so row count equals distinct-pair count. Returns
    {survey_id: completed_voter_count}.
    """
    survey_ids = list(survey_ids)
    if not survey_ids:
        return {}
    required_by_survey = _required_pair_totals(survey_ids)
    required_by_survey = {sid: total for sid, total in required_by_survey.items() if total > 0}
    if not required_by_survey:
        return {}
    voter_answer_counts = (
        Rating.objects
        .filter(
            survey_id__in=required_by_survey.keys(),
            voter__isnull=False,
            person__is_active=True,
            question__is_active=True,
        )
        .values('survey_id', 'voter_id')
        .annotate(answered=Count('id'))
    )
    completed = defaultdict(int)
    for row in voter_answer_counts:
        if row['answered'] >= required_by_survey[row['survey_id']]:
            completed[row['survey_id']] += 1
    return dict(completed)


def calculate_survey_results(survey, request=None):
    """Calculate survey results, counting both authenticated and anonymous participants.

    The general/shared group and each particular person are independent
    completion sections: a participant only needs to finish ALL the
    questions within one section to count as "done" for that section's
    results, regardless of whether they've touched any other section. This
    keeps particular persons from ever affecting (or being gated by) the
    general comparison, and keeps particular persons fully isolated from
    each other too.
    """
    people = list(survey.people.filter(is_active=True).order_by('display_order', 'created_at'))
    general_people = [p for p in people if p.uses_default_questions]
    custom_people = [p for p in people if not p.uses_default_questions]

    def _rank(group_results):
        group_results.sort(key=lambda x: (
            (1, 0) if x['average_score'] is None else (0, -x['average_score']),
            -(x['votes_count']),
            -(x['total_score']),
            x['display_order'],
        ))
        for i, r in enumerate(group_results, 1):
            r['rank'] = i
            del r['display_order']
        return group_results

    results = []
    for group_people in ([general_people] if general_people else []) + [[p] for p in custom_people]:
        completed_voter_ids, completed_anon_tokens = completed_participants_for(survey, group_people)
        group_results = _calculate_group_results(survey, group_people, completed_voter_ids, completed_anon_tokens, request)
        # Rank is computed within its own group only - a particular person is
        # never numbered relative to anyone outside their own isolated section.
        results += _rank(group_results)

    return results


def _calculate_group_results(survey, people, completed_voter_ids, completed_anon_tokens, request=None):
    """Aggregate result dicts for one completion-isolated group of people
    (the general/shared group, or a single particular person)."""
    person_ids = [p.id for p in people]
    base_qs = Rating.objects.filter(
        survey=survey,
        person_id__in=person_ids,
        person__is_active=True,
        question__is_active=True,
    ).filter(
        Q(voter_id__in=completed_voter_ids) |
        Q(anonymous_token__in=completed_anon_tokens)
    )
    voter_counts_raw = (
        base_qs
        .filter(voter__isnull=False)
        .values('person_id')
        .annotate(v_count=Count('voter_id', distinct=True))
    )
    anon_counts_raw = (
        base_qs
        .filter(anonymous_token__isnull=False)
        .values('person_id')
        .annotate(a_count=Count('anonymous_token', distinct=True))
    )
    voter_counts = {row['person_id']: row['v_count'] for row in voter_counts_raw}
    anon_counts = {row['person_id']: row['a_count'] for row in anon_counts_raw}
    combined_voter_counts = {
        pid: voter_counts.get(pid, 0) + anon_counts.get(pid, 0)
        for pid in set(list(voter_counts.keys()) + list(anon_counts.keys()))
    }

    scored_aggregates = {
        row['person_id']: row
        for row in base_qs
        .filter(score__isnull=False)
        .values('person_id')
        .annotate(
            total=Sum('score'),
            score_count=Count('id'),
            avg=Avg('score'),
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
        )
    }

    emoji_question_aggregates = {
        (row['person_id'], row['question_id']): row
        for row in base_qs
        .filter(emoji_rating__isnull=False)
        .annotate(emoji_numeric=_emoji_numeric_annotation())
        .values('person_id', 'question_id')
        .annotate(
            emoji_avg=Avg('emoji_numeric'),
            emoji_count=Count('id'),
        )
    }

    emoji_counts_by_question_choice = defaultdict(lambda: defaultdict(int))
    for row in (
        base_qs
        .filter(emoji_rating__isnull=False)
        .values('person_id', 'question_id', 'emoji_rating')
        .annotate(choice_count=Count('id'))
    ):
        emoji_counts_by_question_choice[(row['person_id'], row['question_id'])][row['emoji_rating']] = row['choice_count']

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

        person_questions = list(effective_questions_for_person(person))
        for question in person_questions:
            q_agg = question_aggregates.get((person.id, question.id), {})
            emoji_agg = emoji_question_aggregates.get((person.id, question.id), {})
            emoji_avg_numeric = emoji_agg.get('emoji_avg')
            emoji_breakdown = emoji_counts_by_question_choice.get((person.id, question.id), {})
            question_results.append({
                'question_id': question.id,
                'question_text': question.text,
                'has_score': question.has_score,
                'score_required': question.score_required,
                'has_comment': question.has_comment,
                'comment_required': question.comment_required,
                'has_emoji': question.has_emoji,
                'emoji_required': question.emoji_required,
                'average_score': round(q_agg['avg'], 2) if q_agg.get('avg') is not None else None,
                'total_score': q_agg.get('total') or 0,
                'responses_count': q_agg.get('score_count') or 0,
                'votes_count': combined_voter_counts.get(person.id, 0),
                'comments_count': len(comments_by_person_question.get((person.id, question.id), [])),
                'average_emoji_numeric': round(emoji_avg_numeric, 2) if emoji_avg_numeric is not None else None,
                'average_emoji_label': emoji_label_for_numeric(emoji_avg_numeric),
                'emoji_responses_count': emoji_agg.get('emoji_count') or 0,
                'emoji_votes_count': combined_voter_counts.get(person.id, 0),
                'emoji_breakdown': {
                    key: emoji_breakdown.get(key, 0) for key, _label in Rating.EMOJI_CHOICES
                },
            })

        results.append({
            'person_id': person.id,
            'full_name': person.full_name,
            'photo_url': _photo_url_for(person, request),
            'department': person.department,
            'role_title': person.role_title,
            'average_score': round(person_score_agg['avg'], 2) if person_score_agg.get('avg') is not None else None,
            'total_score': person_score_agg.get('total') or 0,
            'votes_count': combined_voter_counts.get(person.id, 0),
            'scored_answers_count': person_score_agg.get('score_count') or 0,
            'comments_count': len(comments_by_person.get(person.id, [])),
            'question_results': question_results,
            'uses_default_questions': person.uses_default_questions,
            'question_ids': [question.id for question in person_questions],
            'result_section': 'all' if person.uses_default_questions else f'custom:{person.id}',
            'display_order': person.display_order,
        })

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

        source_shared_questions = source_survey.questions.filter(person__isnull=True).order_by('display_order', 'created_at')
        SurveyQuestion.objects.bulk_create([
            SurveyQuestion(
                survey=duplicate,
                text=question.text,
                help_text=question.help_text,
                has_score=question.has_score,
                score_required=question.score_required,
                has_comment=question.has_comment,
                comment_required=question.comment_required,
                has_emoji=question.has_emoji,
                emoji_required=question.emoji_required,
                display_order=question.display_order,
                is_active=question.is_active,
            )
            for question in source_shared_questions
        ])

        source_people = list(source_survey.people.all().order_by('display_order', 'created_at'))
        new_people = SurveyPerson.objects.bulk_create([
            SurveyPerson(
                survey=duplicate,
                full_name=person.full_name,
                photo=person.photo.name if person.photo else None,
                role_title=person.role_title,
                department=person.department,
                description=person.description,
                display_order=person.display_order,
                is_active=person.is_active,
                uses_default_questions=person.uses_default_questions,
            )
            for person in source_people
        ])

        new_person_by_source_id = {
            source.id: new for source, new in zip(source_people, new_people)
        }
        source_custom_questions = source_survey.questions.filter(person__isnull=False).order_by('display_order', 'created_at')
        SurveyQuestion.objects.bulk_create([
            SurveyQuestion(
                survey=duplicate,
                person=new_person_by_source_id[question.person_id],
                text=question.text,
                help_text=question.help_text,
                has_score=question.has_score,
                score_required=question.score_required,
                has_comment=question.has_comment,
                comment_required=question.comment_required,
                has_emoji=question.has_emoji,
                emoji_required=question.emoji_required,
                display_order=question.display_order,
                is_active=question.is_active,
            )
            for question in source_custom_questions
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
        emoji_rating = answer.get('emoji_rating') or None
        comment = (answer.get('comment') or '').strip()

        if not question.has_score:
            score = None
        elif question.score_required and score is None:
            raise ValueError('ثبت امتیاز برای یکی از سوال‌ها الزامی است.')

        if not question.has_emoji:
            emoji_rating = None
        elif question.emoji_required and not emoji_rating:
            raise ValueError('ثبت امتیاز ایموجی برای یکی از سوال‌ها الزامی است.')

        if not question.has_comment:
            comment = ''
        elif question.comment_required and not comment:
            raise ValueError('ثبت توضیح برای یکی از سوال‌ها الزامی است.')

        enabled_has_value = False
        if question.has_score and score is not None:
            enabled_has_value = True
        if question.has_emoji and emoji_rating:
            enabled_has_value = True
        if question.has_comment and comment:
            enabled_has_value = True
        if not enabled_has_value:
            raise ValueError('هیچ سوالی نباید بدون پاسخ بماند.')

        validated.append({
            'question': question,
            'score': score,
            'emoji_rating': emoji_rating,
            'comment': comment or None,
        })

    return validated


def calculate_survey_progress():
    """
    Build progress data for every survey.
    Tracks authenticated employees only (anonymous participants have no user account).
    """
    from apps.accounts.models import User

    active_employees = list(
        User.objects
        .filter(role='employee', is_active=True)
        .order_by('full_name', 'username', 'id')
        .values('id', 'username', 'full_name')
    )

    latest_employee_response = (
        Rating.objects
        .filter(
            survey_id=OuterRef('pk'),
            voter__role='employee',
            voter__is_active=True,
        )
        .order_by('-created_at')
        .values('created_at')[:1]
    )
    latest_anonymous_response = (
        AnonymousParticipation.objects
        .filter(survey_id=OuterRef('pk'), hash_link__is_active=True)
        .order_by('-completed_at')
        .values('completed_at')[:1]
    )
    custom_questions_count = (
        SurveyQuestion.objects
        .filter(
            survey_id=OuterRef('pk'),
            is_active=True,
            person__isnull=False,
            person__is_active=True,
            person__uses_default_questions=False,
        )
        .values('survey_id')
        .annotate(total=Count('id'))
        .values('total')[:1]
    )
    surveys = list(
        Survey.objects
        .annotate(
            active_people_count=Count('people', filter=Q(people__is_active=True), distinct=True),
            active_questions_count=Count('questions', filter=Q(questions__is_active=True), distinct=True),
            default_people_count=Count('people', filter=Q(people__is_active=True, people__uses_default_questions=True), distinct=True),
            default_questions_count=Count('questions', filter=Q(questions__is_active=True, questions__person__isnull=True), distinct=True),
            custom_answers_count=Coalesce(Subquery(custom_questions_count, output_field=IntegerField()), Value(0)),
            last_employee_response_at=Subquery(latest_employee_response),
            last_anonymous_response_at=Subquery(latest_anonymous_response),
            anon_participant_count=Count(
                'hash_links__anonymous_participant_count',
                filter=Q(hash_links__is_active=True),
                distinct=False,
            ),
        )
        .order_by('-created_at')
        .annotate(required_answers_count=F('default_people_count') * F('default_questions_count') + F('custom_answers_count'))
        .values(
            'id', 'title', 'status', 'active_people_count', 'active_questions_count',
            'required_answers_count', 'last_employee_response_at', 'last_anonymous_response_at',
        )
    )
    from .models import SurveyHashLink
    anon_totals = {
        row['survey_id']: row['total']
        for row in SurveyHashLink.objects
        .values('survey_id')
        .annotate(total=Sum('anonymous_participant_count'))
    }

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
            voter__isnull=False,
            person__is_active=True,
            question__is_active=True,
            person__survey_id=F('survey_id'),
            question__survey_id=F('survey_id'),
        )
        .values('survey_id', 'voter_id')
        .annotate(answered_count=Count('id', distinct=True))
    )

    required_answers_by_survey = {
        survey['id']: survey['required_answers_count']
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
        anonymous_participants = anon_totals.get(survey['id'], 0) if tracking_enabled else 0
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
        response_times = [
            value for value in (
                survey['last_employee_response_at'],
                survey['last_anonymous_response_at'],
            )
            if value is not None
        ]

        progress_items.append({
            'survey_id': survey['id'],
            'title': survey['title'],
            'status': survey['status'],
            'active_people_count': survey['active_people_count'],
            'active_questions_count': survey['active_questions_count'],
            'tracking_enabled': tracking_enabled,
            'assigned_employees': assigned_employees,
            'completed_employees': completed_employees,
            'anonymous_participants': anonymous_participants,
            'pending_employees': pending_employees,
            'completion_percentage': completion_percentage,
            'last_employee_response_at': survey['last_employee_response_at'],
            'last_anonymous_response_at': survey['last_anonymous_response_at'],
            'last_response_at': max(response_times) if response_times else None,
            'pending_users': pending_users,
        })

    total_assigned_responses = sum(item['assigned_employees'] for item in progress_items)
    total_completed_responses = sum(item['completed_employees'] for item in progress_items)
    total_anonymous_participants = sum(item['anonymous_participants'] for item in progress_items)
    total_pending_responses = sum(item['pending_employees'] for item in progress_items)

    return {
        'summary': {
            'total_surveys': len(progress_items),
            'total_assigned_responses': total_assigned_responses,
            'total_completed_responses': total_completed_responses,
            'total_anonymous_participants': total_anonymous_participants,
            'total_pending_responses': total_pending_responses,
            'overall_completion_percentage': (
                round((total_completed_responses / total_assigned_responses) * 100, 1)
                if total_assigned_responses
                else 0.0
            ),
        },
        'surveys': progress_items,
    }
