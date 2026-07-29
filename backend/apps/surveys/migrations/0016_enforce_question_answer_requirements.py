from django.db import migrations, models


def normalize_question_requirements(apps, schema_editor):
    SurveyQuestion = apps.get_model('surveys', 'SurveyQuestion')

    # Recover any legacy question with no usable answer field before adding
    # the database invariant.
    SurveyQuestion.objects.filter(
        has_score=False,
        has_comment=False,
        has_emoji=False,
    ).update(
        has_score=True,
        score_required=True,
        comment_required=False,
        emoji_required=False,
    )

    SurveyQuestion.objects.filter(has_score=False).update(score_required=False)
    SurveyQuestion.objects.filter(has_comment=False).update(comment_required=False)
    SurveyQuestion.objects.filter(has_emoji=False).update(emoji_required=False)

    SurveyQuestion.objects.filter(
        has_score=True,
        has_comment=False,
        has_emoji=False,
    ).update(score_required=True)
    SurveyQuestion.objects.filter(
        has_score=False,
        has_comment=True,
        has_emoji=False,
    ).update(comment_required=True)
    SurveyQuestion.objects.filter(
        has_score=False,
        has_comment=False,
        has_emoji=True,
    ).update(emoji_required=True)


class Migration(migrations.Migration):
    dependencies = [('surveys', '0015_person_specific_questions')]

    operations = [
        migrations.RunPython(
            normalize_question_requirements,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(has_score=True)
                    | models.Q(has_comment=True)
                    | models.Q(has_emoji=True)
                ),
                name='surveyq_has_answer_type',
            ),
        ),
        migrations.AddConstraint(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=models.Q(has_score=True) | models.Q(score_required=False),
                name='surveyq_score_req_enabled',
            ),
        ),
        migrations.AddConstraint(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=models.Q(has_comment=True) | models.Q(comment_required=False),
                name='surveyq_comment_req_enabled',
            ),
        ),
        migrations.AddConstraint(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=models.Q(has_emoji=True) | models.Q(emoji_required=False),
                name='surveyq_emoji_req_enabled',
            ),
        ),
        migrations.AddConstraint(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(has_score=True, has_comment=False, has_emoji=False)
                    | models.Q(score_required=True)
                ),
                name='surveyq_single_score_req',
            ),
        ),
        migrations.AddConstraint(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(has_score=False, has_comment=True, has_emoji=False)
                    | models.Q(comment_required=True)
                ),
                name='surveyq_single_comment_req',
            ),
        ),
        migrations.AddConstraint(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(has_score=False, has_comment=False, has_emoji=True)
                    | models.Q(emoji_required=True)
                ),
                name='surveyq_single_emoji_req',
            ),
        ),
    ]
