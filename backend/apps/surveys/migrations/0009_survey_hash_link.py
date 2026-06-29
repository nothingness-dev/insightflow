from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0008_emoji_rating'),
    ]

    operations = [
        migrations.CreateModel(
            name='SurveyHashLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('survey', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='hash_links',
                    to='surveys.survey',
                    verbose_name='نظرسنجی',
                )),
                ('token', models.CharField(
                    max_length=32,
                    unique=True,
                    verbose_name='توکن هش',
                    db_index=True,
                )),
                ('label', models.CharField(
                    max_length=200,
                    blank=True,
                    verbose_name='برچسب',
                )),
                ('is_active', models.BooleanField(
                    default=True,
                    verbose_name='فعال',
                    db_index=True,
                )),
                ('anonymous_participant_count', models.PositiveIntegerField(
                    default=0,
                    verbose_name='تعداد شرکت‌کنندگان ناشناس',
                )),
                ('created_at', models.DateTimeField(
                    default=django.utils.timezone.now,
                    verbose_name='تاریخ ایجاد',
                )),
            ],
            options={
                'verbose_name': 'لینک هش',
                'verbose_name_plural': 'لینک‌های هش',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='rating',
            name='anonymous_token',
            field=models.CharField(
                max_length=64,
                null=True,
                blank=True,
                verbose_name='توکن ناشناس',
                db_index=True,
            ),
        ),
        migrations.AlterField(
            model_name='rating',
            name='voter',
            field=models.ForeignKey(
                to='accounts.user',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='ratings',
                verbose_name='رأی‌دهنده',
                null=True,
                blank=True,
            ),
        ),
        migrations.AlterUniqueTogether(
            name='rating',
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name='rating',
            constraint=models.UniqueConstraint(
                fields=['survey', 'person', 'question', 'voter'],
                condition=models.Q(voter__isnull=False),
                name='rating_unique_voter',
            ),
        ),
        migrations.AddConstraint(
            model_name='rating',
            constraint=models.UniqueConstraint(
                fields=['survey', 'person', 'question', 'anonymous_token'],
                condition=models.Q(anonymous_token__isnull=False),
                name='rating_unique_anonymous',
            ),
        ),
    ]
