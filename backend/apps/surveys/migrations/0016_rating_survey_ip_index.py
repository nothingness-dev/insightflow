from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('surveys', '0015_person_specific_questions'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='rating',
            index=models.Index(fields=['survey', 'ip_address'], name='rating_survey_ip_idx'),
        ),
    ]
