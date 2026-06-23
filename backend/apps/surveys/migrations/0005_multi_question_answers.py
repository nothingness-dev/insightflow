from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def create_legacy_questions(apps, schema_editor):
    Survey = apps.get_model('surveys', 'Survey')
    SurveyQuestion = apps.get_model('surveys', 'SurveyQuestion')
    Rating = apps.get_model('surveys', 'Rating')

    for survey in Survey.objects.all().iterator():
        text = (survey.question or '').strip() or 'سوال اصلی'
        question = SurveyQuestion.objects.create(
            survey=survey,
            text=text,
            help_text='',
            has_score=True,
            score_required=True,
            has_comment=True,
            comment_required=False,
            display_order=0,
            is_active=True,
        )
        Rating.objects.filter(survey=survey, question__isnull=True).update(question=question)


def reverse_legacy_questions(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0004_remove_employees_visibility'),
    ]

    operations = [
        migrations.CreateModel(
            name='SurveyQuestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField(verbose_name='متن سوال')),
                ('help_text', models.TextField(blank=True, verbose_name='راهنمای سوال')),
                ('has_score', models.BooleanField(default=True, verbose_name='دارای امتیاز عددی')),
                ('score_required', models.BooleanField(default=True, verbose_name='امتیاز عددی الزامی است')),
                ('has_comment', models.BooleanField(default=False, verbose_name='دارای توضیح متنی')),
                ('comment_required', models.BooleanField(default=False, verbose_name='توضیح متنی الزامی است')),
                ('display_order', models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')),
                ('is_active', models.BooleanField(default=True, verbose_name='فعال')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='تاریخ ایجاد')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاریخ به‌روزرسانی')),
                ('survey', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='questions', to='surveys.survey', verbose_name='نظرسنجی')),
            ],
            options={
                'verbose_name': 'سوال نظرسنجی',
                'verbose_name_plural': 'سوال‌های نظرسنجی',
                'ordering': ['display_order', 'created_at'],
            },
        ),
        migrations.AlterField(
            model_name='survey',
            name='question',
            field=models.TextField(blank=True, default='', verbose_name='سوال اصلی قدیمی'),
        ),
        migrations.AlterField(
            model_name='rating',
            name='score',
            field=models.PositiveSmallIntegerField(blank=True, null=True, validators=[MinValueValidator(1), MaxValueValidator(10)], verbose_name='امتیاز'),
        ),
        migrations.AlterUniqueTogether(
            name='rating',
            unique_together=set(),
        ),
        migrations.AddField(
            model_name='rating',
            name='question',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='ratings', to='surveys.surveyquestion', verbose_name='سوال'),
        ),
        migrations.RunPython(create_legacy_questions, reverse_legacy_questions),
        migrations.AlterField(
            model_name='rating',
            name='question',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratings', to='surveys.surveyquestion', verbose_name='سوال'),
        ),
        migrations.AlterUniqueTogether(
            name='rating',
            unique_together={('survey', 'person', 'question', 'voter')},
        ),
    ]
