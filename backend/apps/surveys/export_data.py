   
from collections import defaultdict

from django.db.models import Count, Q

from .models import Rating
from .services import calculate_survey_results, emoji_label_for_numeric, completed_participants_for


PDF_MAX_COMMENTS_PER_QUESTION = 6
PDF_MAX_TOTAL_COMMENTS = 120
EXCEL_CELL_LIMIT = 32_000                                                

EMOJI_LABELS = dict(Rating.EMOJI_CHOICES)
EMOJI_COLORS = {
    Rating.EMOJI_BAD: '#ef4444',
    Rating.EMOJI_AVERAGE: '#f59e0b',
    Rating.EMOJI_GOOD: '#84cc16',
    Rating.EMOJI_EXCELLENT: '#10b981',
}


def score_grade(v):
    if v is None:
        return '—'
    if v < 4:
        return 'ضعیف'
    if v < 6:
        return 'متوسط'
    if v < 8:
        return 'خوب'
    return 'عالی'


def distribution_buckets(results):
    """Return [(label, count, hex_color)] for the score distribution, omitting
    empty buckets."""
    def _count(predicate):
        return sum(1 for r in results if predicate(r['average_score']))

    buckets = [
        ('عالی (۹ به بالا)', _count(lambda v: v is not None and v >= 9),    '#10b981'),
        ('خوب (۷ تا ۹)',     _count(lambda v: v is not None and 7 <= v < 9), '#22c55e'),
        ('متوسط (۴ تا ۷)',   _count(lambda v: v is not None and 4 <= v < 7), '#f59e0b'),
        ('ضعیف (کمتر از ۴)', _count(lambda v: v is not None and v < 4),      '#ef4444'),
        ('بدون امتیاز',      _count(lambda v: v is None),                    '#94a3b8'),
    ]
    return [b for b in buckets if b[1] > 0]


def emoji_distribution_buckets(questions, results):
    """Return [(label, count, hex_color)] for emoji-rating choices across all
    emoji-type questions, omitting empty buckets."""
    totals = defaultdict(int)
    emoji_question_ids = {q.id for q in questions if q.has_emoji}
    if not emoji_question_ids:
        return []
    for r in results:
        for q in r.get('question_results', []):
            if q['question_id'] not in emoji_question_ids:
                continue
            breakdown = q.get('emoji_breakdown') or {}
            for choice, count in breakdown.items():
                totals[choice] += count
    buckets = [
        (EMOJI_LABELS[choice], totals.get(choice, 0), EMOJI_COLORS[choice])
        for choice, _label in Rating.EMOJI_CHOICES
    ]
    return [b for b in buckets if b[1] > 0]


def _build_questions_meta(questions, results, comments_map):
    """Per-question aggregate stats, scoped to the given questions/results pair.

    Reused for the shared/general question set and for each particular
    person's own private question set, so their stats never mix.
    """
    questions_meta = []
    for q in questions:
        scores, total_resps = [], 0
        emoji_numeric_values, emoji_total_resps = [], 0
        for r in results:
            by_q = {item['question_id']: item for item in r.get('question_results', [])}
            item = by_q.get(q.id, {})
            if item.get('average_score') is not None and item.get('responses_count', 0) > 0:
                scores.extend([item['average_score']] * item['responses_count'])
                total_resps += item['responses_count']
            if item.get('average_emoji_numeric') is not None and item.get('emoji_responses_count', 0) > 0:
                emoji_numeric_values.extend([item['average_emoji_numeric']] * item['emoji_responses_count'])
                emoji_total_resps += item['emoji_responses_count']
        total_comments = sum(len(comments_map.get((r['person_id'], q.id), [])) for r in results)
        q_avg = round(sum(scores) / len(scores), 2) if scores else None
        emoji_avg_numeric = round(sum(emoji_numeric_values) / len(emoji_numeric_values), 2) if emoji_numeric_values else None
        questions_meta.append({
            'id': q.id,
            'text': q.text,
            'avg': q_avg if q.has_score else None,
            'responses': total_resps,
            'comments': total_comments,
            'has_score': q.has_score,
            'has_comment': q.has_comment,
            'has_emoji': q.has_emoji,
            'emoji_avg_numeric': emoji_avg_numeric if q.has_emoji else None,
            'emoji_avg_label': emoji_label_for_numeric(emoji_avg_numeric) if q.has_emoji else None,
            'emoji_responses': emoji_total_resps,
        })
    return questions_meta


def _comments_flat_for(questions, results, comments_map):
    return [
        (r['full_name'], r['department'] or '', q.text, comment)
        for r in results
        for q in questions
        if q.has_comment
        for comment in comments_map.get((r['person_id'], q.id), [])
    ]


def build_export_dataset(survey, request=None):
    """Compute everything the export views need, exactly once.

    Particular persons (private/custom questions) are fully excluded from the
    shared summary and question analysis - each gets its own isolated block
    inside `result_groups`, never merged into the general comparison.

    Returns a dict with keys:
        survey, results, questions, comments_map, questions_meta, summary,
        comments_flat, result_groups
    """
    results = calculate_survey_results(survey, request)
    questions = list(
        survey.questions.filter(is_active=True, person__isnull=True).order_by('display_order', 'created_at')
    )

    active_people = list(survey.people.filter(is_active=True))
    general_people = [p for p in active_people if p.uses_default_questions]
    custom_people = [p for p in active_people if not p.uses_default_questions]

    # Shared/general people only - particular persons must not surface in the
    # general summary count, only inside their own isolated result_groups block.
    active_people_count = len(general_people)

    def _comments_for(people):
        """Comment rows for this group only, gated by that group's OWN
        completion - a particular person's completion never depends on (or
        leaks into) the general group's, and vice versa."""
        voter_ids, anon_tokens = completed_participants_for(survey, people)
        rows = defaultdict(list)
        if not voter_ids and not anon_tokens:
            return rows
        person_ids = [p.id for p in people]
        for rating in (Rating.objects
                       .filter(survey=survey, person_id__in=person_ids, person__is_active=True, question__is_active=True)
                       .filter(
                           Q(voter_id__in=voter_ids) |
                           Q(anonymous_token__in=anon_tokens)
                       )
                       .exclude(comment__isnull=True).exclude(comment__exact='')
                       .order_by('person__display_order', 'question__display_order', 'created_at')
                       .values('person_id', 'question_id', 'comment')):
            rows[(rating['person_id'], rating['question_id'])].append(rating['comment'])
        return rows

    comments_map = defaultdict(list)
    for key, rows in _comments_for(general_people).items():
        comments_map[key] = rows
    for person in custom_people:
        for key, rows in _comments_for([person]).items():
            comments_map[key] = rows

    shared_results = [r for r in results if r.get('result_section') == 'all']
    questions_meta = _build_questions_meta(questions, shared_results, comments_map)
    comments_flat = _comments_flat_for(questions, shared_results, comments_map)

    all_scores = [r['average_score'] for r in shared_results if r['average_score'] is not None]
    overall_avg = round(sum(all_scores) / len(all_scores), 2) if all_scores else None
    max_voters = max((r['votes_count'] for r in shared_results), default=0)
    scored_results = [r for r in shared_results if r['average_score'] is not None]

    summary = {
        'overall_avg': overall_avg,
        'questions': len(questions),
        'people': active_people_count,
        'voters': max_voters,
        'best': scored_results[0]['average_score'] if scored_results else None,
        'worst': scored_results[-1]['average_score'] if scored_results else None,
        'total_comments': len(comments_flat),
        'distribution': distribution_buckets(shared_results),
        'emoji_distribution': emoji_distribution_buckets(questions, shared_results),
    }

    custom_person_ids = {
        r['person_id'] for r in results if r.get('result_section', '').startswith('custom:')
    }
    custom_questions_by_person = defaultdict(list)
    if custom_person_ids:
        for q in survey.questions.filter(is_active=True, person_id__in=custom_person_ids).order_by('display_order', 'created_at'):
            custom_questions_by_person[q.person_id].append(q)

    result_groups = [
        {
            'key': 'all', 'title': 'افراد دارای همه سوال‌ها', 'results': shared_results,
            'questions': questions, 'questions_meta': questions_meta,
            'comments_flat': comments_flat,
        },
    ]
    for r in results:
        if not r.get('result_section', '').startswith('custom:'):
            continue
        person_questions = custom_questions_by_person.get(r['person_id'], [])
        person_results = [r]
        result_groups.append({
            'key': r['result_section'],
            'title': f"بخش اختصاصی: {r['full_name']}",
            'results': person_results,
            'questions': person_questions,
            'questions_meta': _build_questions_meta(person_questions, person_results, comments_map),
            'comments_flat': _comments_flat_for(person_questions, person_results, comments_map),
        })

    return {
        'survey': survey,
        'results': results,
        'questions': questions,
        'comments_map': comments_map,
        'questions_meta': questions_meta,
        'summary': summary,
        'comments_flat': comments_flat,
        'result_groups': result_groups,
    }


def build_pdf_comment_groups(dataset,
                             per_question=PDF_MAX_COMMENTS_PER_QUESTION,
                             total_cap=PDF_MAX_TOTAL_COMMENTS,
                             group=None):
    """Group comments by question and cap them for the (bounded) PDF report.

    By default groups comments for the shared/general question set. Pass a
    `result_groups` entry (from `build_export_dataset`) as `group` to build
    the isolated comment groups for one particular person instead.

    Returns (groups, truncated) where groups is a list of dicts:
        {question, items: [(person, dept, comment)], total, extra}
    `extra` is how many comments for that question were omitted.
    `truncated` is True if any cap kicked in (so the view can show a note).
    """
    results = group['results'] if group is not None else dataset['results']
    questions = group['questions'] if group is not None else dataset['questions']
    comments_map = dataset['comments_map']
    groups = []
    rendered = 0
    truncated = False

    for q in questions:
        if not q.has_comment:
            continue
        items = []
        total = 0
        for r in results:
            for comment in comments_map.get((r['person_id'], q.id), []):
                total += 1
                if len(items) < per_question and rendered < total_cap:
                    items.append((r['full_name'], r['department'] or '', comment))
                    rendered += 1
        if total == 0:
            continue
        extra = total - len(items)
        if extra > 0:
            truncated = True
        groups.append({'question': q.text, 'items': items, 'total': total, 'extra': extra})

    return groups, truncated
