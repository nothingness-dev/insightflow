
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('login', 'ورود به سیستم'), ('login_failed', 'ورود ناموفق'), ('logout', 'خروج از سیستم'), ('password_change', 'تغییر رمز عبور'), ('password_reset', 'بازنشانی رمز عبور'), ('user_create', 'ایجاد کاربر'), ('user_edit', 'ویرایش کاربر'), ('user_delete', 'حذف کاربر'), ('user_activate', 'فعال\u200cسازی کاربر'), ('user_deactivate', 'غیرفعال\u200cسازی کاربر'), ('bulk_employee_import', 'ورود گروهی کارکنان'), ('survey_create', 'ایجاد نظرسنجی'), ('survey_edit', 'ویرایش نظرسنجی'), ('survey_delete', 'حذف نظرسنجی'), ('survey_duplicate', 'تکثیر نظرسنجی'), ('survey_publish', 'انتشار نظرسنجی'), ('survey_close', 'بستن نظرسنجی'), ('question_add', 'افزودن سوال'), ('question_edit', 'ویرایش سوال'), ('question_delete', 'حذف سوال'), ('export_csv', 'خروجی CSV'), ('export_excel', 'خروجی Excel'), ('export_pdf', 'خروجی PDF'), ('delete_all_data', 'حذف تمام داده\u200cها')], db_index=True, max_length=40, verbose_name='نوع فعالیت')),
                ('actor_username', models.CharField(blank=True, db_index=True, max_length=150, verbose_name='نام کاربری')),
                ('actor_full_name', models.CharField(blank=True, max_length=200, verbose_name='نام کامل')),
                ('actor_role', models.CharField(blank=True, max_length=20, verbose_name='نقش')),
                ('description', models.CharField(blank=True, max_length=500, verbose_name='شرح فعالیت')),
                ('target_type', models.CharField(blank=True, max_length=40, verbose_name='نوع هدف')),
                ('target_id', models.CharField(blank=True, max_length=40, verbose_name='شناسه هدف')),
                ('target_repr', models.CharField(blank=True, max_length=300, verbose_name='عنوان هدف')),
                ('status', models.CharField(choices=[('success', 'موفق'), ('failed', 'ناموفق')], db_index=True, default='success', max_length=10, verbose_name='وضعیت')),
                ('is_critical', models.BooleanField(db_index=True, default=False, verbose_name='حساس')),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True, verbose_name='آدرس IP')),
                ('user_agent', models.CharField(blank=True, max_length=300, verbose_name='مرورگر')),
                ('metadata', models.JSONField(blank=True, default=dict, verbose_name='اطلاعات تکمیلی')),
                ('created_at', models.DateTimeField(db_index=True, default=django.utils.timezone.now, verbose_name='زمان')),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='activity_logs', to=settings.AUTH_USER_MODEL, verbose_name='کاربر')),
            ],
            options={
                'verbose_name': 'گزارش فعالیت',
                'verbose_name_plural': 'گزارش\u200cهای فعالیت',
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['-created_at'], name='activity_ac_created_d34040_idx'), models.Index(fields=['action', '-created_at'], name='activity_ac_action_4b3c59_idx'), models.Index(fields=['is_critical', '-created_at'], name='activity_ac_is_crit_42081f_idx'), models.Index(fields=['actor', '-created_at'], name='activity_ac_actor_i_3a6bb7_idx')],
            },
        ),
    ]
