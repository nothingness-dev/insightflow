# Generated for insightflow initial schema.

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import apps.surveys.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Survey',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=300, verbose_name='عنوان')),
                ('question', models.TextField(verbose_name='سوال اصلی')),
                ('description', models.TextField(blank=True, verbose_name='توضیحات')),
                ('status', models.CharField(choices=[('draft', 'پیش‌نویس'), ('published', 'منتشر شده'), ('closed', 'بسته شده')], default='draft', max_length=20, verbose_name='وضعیت')),
                ('results_visibility', models.CharField(choices=[('admin_only', 'فقط مدیر'), ('employees_after_close', 'کارکنان پس از بسته شدن')], default='admin_only', max_length=30, verbose_name='نمایش نتایج')),
                ('starts_at', models.DateTimeField(blank=True, null=True, verbose_name='تاریخ شروع')),
                ('ends_at', models.DateTimeField(blank=True, null=True, verbose_name='تاریخ پایان')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='تاریخ ایجاد')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاریخ به‌روزرسانی')),
                ('published_at', models.DateTimeField(blank=True, null=True, verbose_name='تاریخ انتشار')),
                ('closed_at', models.DateTimeField(blank=True, null=True, verbose_name='تاریخ بستن')),
                ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_surveys', to=settings.AUTH_USER_MODEL, verbose_name='ایجادکننده')),
            ],
            options={
                'verbose_name': 'نظرسنجی',
                'verbose_name_plural': 'نظرسنجی‌ها',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='SurveyPerson',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=200, verbose_name='نام و نام خانوادگی')),
                ('photo', models.ImageField(blank=True, null=True, upload_to=apps.surveys.models.person_photo_upload_path, verbose_name='تصویر')),
                ('role_title', models.CharField(blank=True, max_length=200, verbose_name='سمت')),
                ('department', models.CharField(blank=True, max_length=200, verbose_name='واحد سازمانی')),
                ('description', models.TextField(blank=True, verbose_name='توضیحات')),
                ('display_order', models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')),
                ('is_active', models.BooleanField(default=True, verbose_name='فعال')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='تاریخ ایجاد')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='تاریخ به‌روزرسانی')),
                ('survey', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='people', to='surveys.survey', verbose_name='نظرسنجی')),
            ],
            options={
                'verbose_name': 'شخص',
                'verbose_name_plural': 'افراد',
                'ordering': ['display_order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='Rating',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('score', models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)], verbose_name='امتیاز')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True, verbose_name='آدرس IP')),
                ('user_agent', models.TextField(blank=True, null=True, verbose_name='مرورگر')),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now, verbose_name='تاریخ ثبت')),
                ('person', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratings', to='surveys.surveyperson', verbose_name='شخص')),
                ('survey', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratings', to='surveys.survey', verbose_name='نظرسنجی')),
                ('voter', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ratings', to=settings.AUTH_USER_MODEL, verbose_name='رأی‌دهنده')),
            ],
            options={
                'verbose_name': 'امتیاز',
                'verbose_name_plural': 'امتیازها',
                'unique_together': {('survey', 'person', 'voter')},
            },
        ),
    ]
