from django.db import migrations, models
import django.db.models.deletion


def reset_custom_people_to_default(apps, schema_editor):
    """Reset every person that used the old checkbox-based custom question
    assignment back to the shared/default question set, since the new
    person-owned question model replaces that flow entirely."""
    SurveyPerson = apps.get_model('surveys', 'SurveyPerson')
    SurveyPerson.objects.filter(uses_default_questions=False).update(uses_default_questions=True)


class Migration(migrations.Migration):
    dependencies = [('surveys', '0014_alter_rating_emoji_rating')]

    operations = [
        migrations.RunPython(reset_custom_people_to_default, migrations.RunPython.noop),
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
