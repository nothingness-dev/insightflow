from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('surveys', '0012_surveyhashlink_expires_at_surveyhashlink_expiry_unit_and_more')]
    operations = [
        migrations.AddField(model_name='surveyquestion', name='default_for_everyone', field=models.BooleanField(default=True, verbose_name='نمایش پیش‌فرض برای همه افراد')),
        migrations.AddField(model_name='surveyperson', name='uses_default_questions', field=models.BooleanField(default=True, verbose_name='استفاده از سوال‌های پیش‌فرض')),
        migrations.AddField(model_name='surveyperson', name='assigned_questions', field=models.ManyToManyField(blank=True, related_name='custom_people', to='surveys.surveyquestion', verbose_name='سوال‌های اختصاصی')),
    ]
