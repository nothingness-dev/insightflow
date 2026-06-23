from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0003_remove_survey_dates'),
    ]

    operations = [
        migrations.RunSQL(
            "UPDATE surveys_survey SET results_visibility = 'admin_only' WHERE results_visibility = 'employees_after_close';",
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.AlterField(
            model_name='survey',
            name='results_visibility',
            field=models.CharField(
                choices=[('admin_only', 'فقط مدیر')],
                default='admin_only',
                max_length=30,
                verbose_name='نمایش نتایج',
            ),
        ),
    ]
