"""Query and Excel helpers for the admin IP Response Audit feature."""

import io
from collections import OrderedDict

from django.core.paginator import Paginator
from django.db.models import Case, CharField, Count, F, Max, Q, Value, When
from django.db.models.functions import Cast, Concat
from django.utils import timezone

from apps.core.export_security import sanitize_cell

from .models import Rating, SurveyPerson


EMOJI_VISUALS = {
    Rating.EMOJI_BAD: '😞',
    Rating.EMOJI_AVERAGE: '😐',
    Rating.EMOJI_GOOD: '🙂',
    Rating.EMOJI_EXCELLENT: '😍',
}


def _submission_identifier(rating):
    if rating.voter_id:
        return f'user:{rating.voter_id}'
    if rating.anonymous_token:
        return f'anonymous:{rating.anonymous_token}'
    return f'legacy-rating:{rating.id}'


def _question_type(question):
    kinds = []
    if question.has_score:
        kinds.append('numeric')
    if question.has_emoji:
        kinds.append('emoji')
    if question.has_comment:
        kinds.append('text')
    return '+'.join(kinds) or 'unknown'


def _submission_key_expression():
    return Case(
        When(
            voter_id__isnull=False,
            then=Concat(Value('user:'), Cast('voter_id', CharField())),
        ),
        When(
            Q(anonymous_token__isnull=False) & ~Q(anonymous_token=''),
            then=Concat(Value('anonymous:'), F('anonymous_token')),
        ),
        default=Concat(Value('legacy-rating:'), Cast('id', CharField())),
        output_field=CharField(),
    )


def audit_ratings_queryset(survey, ip_address):
    return (
        Rating.objects
        .filter(survey=survey, ip_address=ip_address)
        .select_related('person', 'question', 'voter')
        .order_by(
            'person__display_order', 'person__id',
            'created_at', 'question__display_order', 'question__id', 'id',
        )
    )


def _audit_summary(survey, ip_address):
    return (
        Rating.objects
        .filter(survey=survey, ip_address=ip_address)
        .aggregate(
            total_answers=Count('id'),
            total_linked_submissions=Count(
                _submission_key_expression(), distinct=True,
            ),
            total_surveyed_people=Count('person_id', distinct=True),
            latest_submission_at=Max('created_at'),
        )
    )


def build_ip_audit_payload(survey, ip_address, page=None, page_size=None):
    """Return ratings grouped without ever merging different evaluated people."""
    pagination = None
    ratings_queryset = audit_ratings_queryset(survey, ip_address)
    if page is not None and page_size is not None:
        people_queryset = (
            SurveyPerson.objects
            .filter(
                survey=survey,
                ratings__survey=survey,
                ratings__ip_address=ip_address,
            )
            .distinct()
            .order_by('display_order', 'id')
        )
        people_page = Paginator(people_queryset, page_size).get_page(page)
        person_ids = [person.id for person in people_page.object_list]
        ratings_queryset = ratings_queryset.filter(person_id__in=person_ids)
        pagination = {
            'page': people_page.number,
            'page_size': page_size,
            'total': people_page.paginator.count,
            'total_pages': people_page.paginator.num_pages,
            'has_previous': people_page.has_previous(),
            'has_next': people_page.has_next(),
        }

    ratings = list(ratings_queryset)
    people = OrderedDict()

    for rating in ratings:
        identifier = _submission_identifier(rating)

        person_group = people.setdefault(rating.person_id, {
            'surveyed_person_id': rating.person_id,
            'surveyed_person_name': rating.person.full_name,
            'role_title': rating.person.role_title,
            'department': rating.person.department,
            'submissions': OrderedDict(),
        })
        submission = person_group['submissions'].setdefault(identifier, {
            'submission_identifier': identifier,
            'submitted_at': rating.created_at,
            'answers': [],
        })
        if rating.created_at > submission['submitted_at']:
            submission['submitted_at'] = rating.created_at

        submission['answers'].append({
            'selected_ip_address': str(ip_address),
            'survey_id': survey.id,
            'survey_title': survey.title,
            'submission_identifier': identifier,
            'submitted_at': rating.created_at,
            'surveyed_person_id': rating.person_id,
            'surveyed_person_name': rating.person.full_name,
            'question_id': rating.question_id,
            'question_order': rating.question.display_order,
            'question_text': rating.question.text,
            'question_type': _question_type(rating.question),
            'numeric_score': rating.score,
            'emoji_rating': rating.emoji_rating,
            'emoji_label': rating.get_emoji_rating_display() if rating.emoji_rating else None,
            'free_text_answer': rating.comment or None,
        })

    serialized_people = []
    for person in people.values():
        person['submissions'] = list(person['submissions'].values())
        serialized_people.append(person)

    payload = {
        'survey': {'id': survey.id, 'title': survey.title},
        'selected_ip_address': str(ip_address),
        'summary': _audit_summary(survey, ip_address),
        'people': serialized_people,
    }
    if pagination is not None:
        payload['pagination'] = pagination
    return payload


def available_ip_payload(survey, search='', page=1, page_size=8):
    """Return a paginated, searchable list of IPs represented in this survey."""
    ratings = Rating.objects.filter(survey=survey, ip_address__isnull=False)
    if search:
        ratings = ratings.filter(ip_address__icontains=search)

    grouped = (
        ratings
        .values('ip_address')
        .annotate(
            response_count=Count('id'),
            surveyed_person_count=Count('person_id', distinct=True),
            submission_count=Count(_submission_key_expression(), distinct=True),
            latest_submission_at=Max('created_at'),
        )
        .order_by('-latest_submission_at', 'ip_address')
    )
    ip_page = Paginator(grouped, page_size).get_page(page)
    items = [
        {
            'ip_address': str(row['ip_address']),
            'response_count': row['response_count'],
            'surveyed_person_count': row['surveyed_person_count'],
            'submission_count': row['submission_count'],
            'latest_submission_at': row['latest_submission_at'],
        }
        for row in ip_page.object_list
    ]
    return {
        'ips': items,
        'pagination': {
            'page': ip_page.number,
            'page_size': page_size,
            'total': ip_page.paginator.count,
            'total_pages': ip_page.paginator.num_pages,
            'has_previous': ip_page.has_previous(),
            'has_next': ip_page.has_next(),
        },
    }


def build_ip_audit_workbook(survey, ip_address, payload):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = 'ممیزی پاسخ IP'
    sheet.sheet_view.rightToLeft = True
    sheet.freeze_panes = 'A7'
    sheet.sheet_view.showGridLines = False

    title_fill = PatternFill('solid', fgColor='4F46E5')
    header_fill = PatternFill('solid', fgColor='1E293B')
    thin = Side(style='thin', color='E2E8F0')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    right = Alignment(horizontal='right', vertical='center', wrap_text=True)
    center = Alignment(horizontal='center', vertical='center', wrap_text=True)

    sheet.append([sanitize_cell(f'ممیزی پاسخ‌های IP — {survey.title}')])
    sheet.merge_cells('A1:J1')
    sheet['A1'].fill = title_fill
    sheet['A1'].font = Font(bold=True, color='FFFFFF', size=14)
    sheet['A1'].alignment = center
    sheet.append(['عنوان نظرسنجی', sanitize_cell(survey.title)])
    sheet.append(['آدرس IP انتخاب‌شده', sanitize_cell(str(ip_address))])
    sheet.append(['زمان تولید خروجی', timezone.localtime().strftime('%Y-%m-%d %H:%M:%S')])
    sheet.append([])

    headers = [
        'IP address', 'submission identifier', 'submitted at', 'surveyed person',
        'question order', 'question text', 'answer type', 'numeric score',
        'emoji rating', 'free-text answer',
    ]
    sheet.append(headers)
    for cell in sheet[6]:
        cell.fill = header_fill
        cell.font = Font(bold=True, color='FFFFFF')
        cell.alignment = center
        cell.border = border

    for person in payload['people']:
        for submission in person['submissions']:
            for answer in submission['answers']:
                emoji = ''
                if answer['emoji_rating']:
                    emoji = (
                        f"{EMOJI_VISUALS.get(answer['emoji_rating'], '')} "
                        f"{answer['emoji_label'] or answer['emoji_rating']}"
                    ).strip()
                sheet.append([
                    sanitize_cell(answer['selected_ip_address']),
                    sanitize_cell(answer['submission_identifier']),
                    timezone.localtime(answer['submitted_at']).strftime('%Y-%m-%d %H:%M:%S'),
                    sanitize_cell(answer['surveyed_person_name']),
                    answer['question_order'],
                    sanitize_cell(answer['question_text']),
                    answer['question_type'],
                    answer['numeric_score'] if answer['numeric_score'] is not None else '',
                    sanitize_cell(emoji),
                    sanitize_cell(answer['free_text_answer'] or ''),
                ])
                for column, cell in enumerate(sheet[sheet.max_row], 1):
                    cell.border = border
                    cell.alignment = center if column in (5, 8) else right

    widths = [20, 28, 21, 26, 14, 45, 18, 14, 20, 55]
    for index, width in enumerate(widths, 1):
        sheet.column_dimensions[chr(64 + index)].width = width
    sheet.auto_filter.ref = f'A6:J{max(sheet.max_row, 6)}'

    output = io.BytesIO()
    workbook.save(output)
    return output.getvalue()
