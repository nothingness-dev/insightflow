from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('surveys', '0013_question_assignments')]

    operations = [
        migrations.AlterField(
            model_name='rating',
            name='emoji_rating',
            field=models.CharField(
                blank=True,
                choices=[('bad', 'ضعیف'), ('average', 'متوسط'), ('good', 'خوب'), ('excellent', 'عالی')],
                max_length=20,
                null=True,
                verbose_name='امتیاز ایموجی',
            ),
        ),
    ]
