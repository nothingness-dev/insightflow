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

        results.append({
            'person_id': person.id,
            'full_name': person.full_name,
            'photo_url': photo_url,
            'department': person.department,
            'role_title': person.role_title,
            'average_score': round(agg['avg'], 2) if agg['avg'] else None,
            'total_score': agg['total'] or 0,
            'votes_count': agg['count'] or 0,
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
