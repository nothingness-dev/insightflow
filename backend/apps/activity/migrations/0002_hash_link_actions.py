from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('activity', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='activitylog',
            name='action',
            field=models.CharField(
                db_index=True,
                max_length=40,
                verbose_name='نوع فعالیت',
            ),
        ),
    ]
