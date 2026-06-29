from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0010_anonymous_participation_ip_lock'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='rating',
            index=models.Index(fields=['survey', 'anonymous_token'], name='rating_survey_anon_idx'),
        ),
    ]
