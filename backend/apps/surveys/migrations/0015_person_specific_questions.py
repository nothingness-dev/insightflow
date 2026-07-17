from django.db import migrations, models
import django.db.models.deletion


def migrate_assigned_questions_to_person_owned(apps, schema_editor):
    """For each person that had custom assigned questions (uses_default_questions=False),
    clone those questions as person-owned records so the data is preserved."""
    SurveyPerson = apps.get_model('surveys', 'SurveyPerson')
    SurveyQuestion = apps.get_model('surveys', 'SurveyQuestion')

    for person in SurveyPerson.objects.filter(uses_default_questions=False):
        assigned = person.assigned_questions.all()
        for idx, question in enumerate(assigned):
            SurveyQuestion.objects.create(
                survey=person.survey,
                text=question.text,
                help_text=question.help_text,
                has_score=question.has_score,
                score_required=question.score_required,
                has_comment=question.has_comment,
                comment_required=question.comment_required,
                has_emoji=question.has_emoji,
                emoji_required=question.emoji_required,
                display_order=idx,
                is_active=question.is_active,
                person=person,
                created_at=question.created_at,
                updated_at=question.updated_at,
            )


class Migration(migrations.Migration):
    dependencies = [('surveys', '0014_alter_rating_emoji_rating')]

    operations = [
        migrations.RunPython(migrate_assigned_questions_to_person_owned, migrations.RunPython.noop),
        migrations.RemoveField(model_name='surveyperson', name='assigned_questions'),
        migrations.RemoveField(model_name='surveyquestion', name='default_for_everyone'),
        migrations.AddField(
            model_name='surveyquestion',
            name='person',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                related_name='custom_questions', to='surveys.surveyperson',
                verbose_name='سوال اختصاصی برای فرد',
            ),
        ),
    ]
