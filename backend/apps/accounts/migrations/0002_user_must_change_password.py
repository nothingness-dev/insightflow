from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='must_change_password',
            field=models.BooleanField(
                default=False,
                help_text='در اولین ورود، کاربر ملزم به تغییر رمز عبور خود می\u200cشود.',
                verbose_name='باید رمز عبور را تغییر دهد',
            ),
        ),
    ]
