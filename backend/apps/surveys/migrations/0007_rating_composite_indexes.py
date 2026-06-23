from django.db import migrations, models


class Migration(migrations.Migration):
    """Add composite indexes to the Rating table.

    These cover the two most-queried access patterns:
      - (survey, voter)  — used by the completion check (has this voter finished?)
      - (survey, person) — used by result aggregation (scores for this person)

    Without these indexes both queries require a full-table scan once the
    Rating table grows beyond a few thousand rows.
    """

    dependencies = [
        ('surveys', '0006_alter_rating_options'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='rating',
            index=models.Index(
                fields=['survey', 'voter'],
                name='rating_survey_voter_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='rating',
            index=models.Index(
                fields=['survey', 'person'],
                name='rating_survey_person_idx',
            ),
        ),
    ]
