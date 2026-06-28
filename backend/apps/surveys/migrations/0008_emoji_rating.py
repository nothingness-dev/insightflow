from django.db import migrations, models


class Migration(migrations.Migration):
    """Add the emoji rating question type.

    Mirrors has_score/score_required and has_comment/comment_required with a
    third pair (has_emoji/emoji_required) on SurveyQuestion, and a matching
    emoji_rating field on Rating to store the selected value
    (بد / متوسط / خوب / عالی).
    """

    dependencies = [
        ('surveys', '0007_rating_composite_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='surveyquestion',
            name='has_emoji',
            field=models.BooleanField(default=False, verbose_name='دارای امتیاز ایموجی'),
        ),
        migrations.AddField(
            model_name='surveyquestion',
            name='emoji_required',
            field=models.BooleanField(default=False, verbose_name='امتیاز ایموجی الزامی است'),
        ),
        migrations.AddField(
            model_name='rating',
            name='emoji_rating',
            field=models.CharField(
                blank=True, null=True, max_length=20,
                choices=[
                    ('bad', 'بد'),
                    ('average', 'متوسط'),
                    ('good', 'خوب'),
                    ('excellent', 'عالی'),
                ],
                verbose_name='امتیاز ایموجی',
            ),
        ),
    ]
