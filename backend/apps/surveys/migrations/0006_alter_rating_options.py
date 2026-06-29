
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0005_multi_question_answers'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='rating',
            options={'verbose_name': 'پاسخ', 'verbose_name_plural': 'پاسخ\u200cها'},
        ),
    ]
