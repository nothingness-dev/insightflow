from django.db import transaction
from django.db.models import Sum, Count, Avg
from .models import Survey, SurveyPerson, Rating


def calculate_survey_results(survey, request=None):
    """محاسبه نتایج ناشناس نظرسنجی"""
    people = survey.people.filter(is_active=True).prefetch_related('ratings')

    results = []
    for person in people:
        person_ratings = person.ratings.filter(survey=survey)
        agg = person_ratings.aggregate(
            total=Sum('score'),
            count=Count('id'),
            avg=Avg('score')
        )
        photo_url = None
        if person.photo:
            if request:
                photo_url = request.build_absolute_uri(person.photo.url)
            else:
                photo_url = person.photo.url

        # Collect non-empty comments (anonymous — no voter info attached)
        comments = list(
            person_ratings
            .exclude(comment__isnull=True)
            .exclude(comment__exact='')
            .values_list('comment', flat=True)
        )

        results.append({
            'person_id': person.id,
            'full_name': person.full_name,
            'photo_url': photo_url,
            'department': person.department,
            'role_title': person.role_title,
            'average_score': round(agg['avg'], 2) if agg['avg'] else None,
            'total_score': agg['total'] or 0,
            'votes_count': agg['count'] or 0,
            'comments': comments,
            'display_order': person.display_order,
        })

    # Sort: avg desc, count desc, total desc, display_order asc
    results.sort(key=lambda x: (
        -(x['average_score'] or -1),
        -(x['votes_count']),
        -(x['total_score']),
        x['display_order']
    ))

    # Add rank
    for i, r in enumerate(results, 1):
        r['rank'] = i
        del r['display_order']

    return results

def duplicate_survey(source_survey, created_by):
    """Create a draft survey clone with copied people and no responses."""
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

