from django.db import migrations, models


class AddConstraintIfMissing(migrations.AddConstraint):
    """Keep this branch compatible with databases previously migrated on main."""

    def database_forwards(self, app_label, schema_editor, from_state, to_state):
        model = to_state.apps.get_model(app_label, self.model_name)
        if not self.allow_migrate_model(schema_editor.connection.alias, model):
            return

        with schema_editor.connection.cursor() as cursor:
            existing = schema_editor.connection.introspection.get_constraints(
                cursor,
                model._meta.db_table,
            )
        if self.constraint.name in existing:
            return

        super().database_forwards(app_label, schema_editor, from_state, to_state)


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
    # PostgreSQL must commit the data-normalization UPDATEs before constraints
    # can ALTER this table; otherwise pending FK trigger events block the DDL.
    atomic = False

    dependencies = [('surveys', '0016_rating_survey_ip_index')]

    operations = [
        migrations.RunPython(
            normalize_question_requirements,
            migrations.RunPython.noop,
            atomic=True,
        ),
        AddConstraintIfMissing(
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
        AddConstraintIfMissing(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=models.Q(has_score=True) | models.Q(score_required=False),
                name='surveyq_score_req_enabled',
            ),
        ),
        AddConstraintIfMissing(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=models.Q(has_comment=True) | models.Q(comment_required=False),
                name='surveyq_comment_req_enabled',
            ),
        ),
        AddConstraintIfMissing(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=models.Q(has_emoji=True) | models.Q(emoji_required=False),
                name='surveyq_emoji_req_enabled',
            ),
        ),
        AddConstraintIfMissing(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(has_score=True, has_comment=False, has_emoji=False)
                    | models.Q(score_required=True)
                ),
                name='surveyq_single_score_req',
            ),
        ),
        AddConstraintIfMissing(
            model_name='surveyquestion',
            constraint=models.CheckConstraint(
                condition=(
                    ~models.Q(has_score=False, has_comment=True, has_emoji=False)
                    | models.Q(comment_required=True)
                ),
                name='surveyq_single_comment_req',
            ),
        ),
        AddConstraintIfMissing(
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
