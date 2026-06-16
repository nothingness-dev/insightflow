from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0002_rating_comment'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='survey',
            name='starts_at',
        ),
        migrations.RemoveField(
            model_name='survey',
            name='ends_at',
        ),
    ]
