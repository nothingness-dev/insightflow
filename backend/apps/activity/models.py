from django.conf import settings
from django.db import models
from django.utils import timezone


class ActivityActions:
    """Canonical action codes recorded in the audit log."""
    LOGIN = 'login'
    LOGIN_FAILED = 'login_failed'
    LOGOUT = 'logout'
    PASSWORD_CHANGE = 'password_change'
    PASSWORD_RESET = 'password_reset'

    USER_CREATE = 'user_create'
    USER_EDIT = 'user_edit'
    USER_DELETE = 'user_delete'
    USER_ACTIVATE = 'user_activate'
    USER_DEACTIVATE = 'user_deactivate'
    BULK_IMPORT = 'bulk_employee_import'
    SURVEY_CREATE = 'survey_create'
    SURVEY_EDIT = 'survey_edit'
    SURVEY_DELETE = 'survey_delete'
    SURVEY_DUPLICATE = 'survey_duplicate'
    SURVEY_PUBLISH = 'survey_publish'
    SURVEY_CLOSE = 'survey_close'
    QUESTION_ADD = 'question_add'
    QUESTION_EDIT = 'question_edit'
    QUESTION_DELETE = 'question_delete'
    EXPORT_CSV = 'export_csv'
    EXPORT_EXCEL = 'export_excel'
    EXPORT_PDF = 'export_pdf'
    DELETE_ALL_DATA = 'delete_all_data'
    HASH_LINK_CREATE = 'hash_link_create'
    HASH_LINK_DELETE = 'hash_link_delete'
    HASH_LINK_TOGGLE = 'hash_link_toggle'
    ANONYMOUS_VOTE = 'anonymous_vote'


ACTION_LABELS = {
    ActivityActions.LOGIN: 'ورود به سیستم',
    ActivityActions.LOGIN_FAILED: 'ورود ناموفق',
    ActivityActions.LOGOUT: 'خروج از سیستم',
    ActivityActions.PASSWORD_CHANGE: 'تغییر رمز عبور',
    ActivityActions.PASSWORD_RESET: 'بازنشانی رمز عبور',
    ActivityActions.USER_CREATE: 'ایجاد کاربر',
    ActivityActions.USER_EDIT: 'ویرایش کاربر',
    ActivityActions.USER_DELETE: 'حذف کاربر',
    ActivityActions.USER_ACTIVATE: 'فعال‌سازی کاربر',
    ActivityActions.USER_DEACTIVATE: 'غیرفعال‌سازی کاربر',
    ActivityActions.BULK_IMPORT: 'ورود گروهی کارکنان',
    ActivityActions.SURVEY_CREATE: 'ایجاد نظرسنجی',
    ActivityActions.SURVEY_EDIT: 'ویرایش نظرسنجی',
    ActivityActions.SURVEY_DELETE: 'حذف نظرسنجی',
    ActivityActions.SURVEY_DUPLICATE: 'تکثیر نظرسنجی',
    ActivityActions.SURVEY_PUBLISH: 'انتشار نظرسنجی',
    ActivityActions.SURVEY_CLOSE: 'بستن نظرسنجی',
    ActivityActions.QUESTION_ADD: 'افزودن سوال',
    ActivityActions.QUESTION_EDIT: 'ویرایش سوال',
    ActivityActions.QUESTION_DELETE: 'حذف سوال',
    ActivityActions.EXPORT_CSV: 'خروجی CSV',
    ActivityActions.EXPORT_EXCEL: 'خروجی Excel',
    ActivityActions.EXPORT_PDF: 'خروجی PDF',
    ActivityActions.DELETE_ALL_DATA: 'حذف تمام داده‌ها',
    ActivityActions.HASH_LINK_CREATE: 'ایجاد لینک هش',
    ActivityActions.HASH_LINK_DELETE: 'حذف لینک هش',
    ActivityActions.HASH_LINK_TOGGLE: 'تغییر وضعیت لینک هش',
    ActivityActions.ANONYMOUS_VOTE: 'رأی ناشناس',
}

ACTION_CHOICES = [(code, label) for code, label in ACTION_LABELS.items()]

CRITICAL_ACTIONS = {
    ActivityActions.LOGIN_FAILED,
    ActivityActions.PASSWORD_RESET,
    ActivityActions.USER_DELETE,
    ActivityActions.USER_DEACTIVATE,
    ActivityActions.SURVEY_DELETE,
    ActivityActions.BULK_IMPORT,
    ActivityActions.DELETE_ALL_DATA,
    ActivityActions.HASH_LINK_DELETE,
}


class ActivityLog(models.Model):
    STATUS_SUCCESS = 'success'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_SUCCESS, 'موفق'),
        (STATUS_FAILED, 'ناموفق'),
    ]

    action = models.CharField(
        max_length=40, db_index=True, verbose_name='نوع فعالیت'
    )

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='activity_logs', verbose_name='کاربر'
    )
    actor_username = models.CharField(max_length=150, blank=True, db_index=True, verbose_name='نام کاربری')
    actor_full_name = models.CharField(max_length=200, blank=True, verbose_name='نام کامل')
    actor_role = models.CharField(max_length=20, blank=True, verbose_name='نقش')

    description = models.CharField(max_length=500, blank=True, verbose_name='شرح فعالیت')

    target_type = models.CharField(max_length=40, blank=True, verbose_name='نوع هدف')
    target_id = models.CharField(max_length=40, blank=True, verbose_name='شناسه هدف')
    target_repr = models.CharField(max_length=300, blank=True, verbose_name='عنوان هدف')

    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default=STATUS_SUCCESS,
        db_index=True, verbose_name='وضعیت'
    )
    is_critical = models.BooleanField(default=False, db_index=True, verbose_name='حساس')

    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='آدرس IP')
    user_agent = models.CharField(max_length=300, blank=True, verbose_name='مرورگر')

    metadata = models.JSONField(default=dict, blank=True, verbose_name='اطلاعات تکمیلی')

    created_at = models.DateTimeField(default=timezone.now, db_index=True, verbose_name='زمان')

    class Meta:
        verbose_name = 'گزارش فعالیت'
        verbose_name_plural = 'گزارش‌های فعالیت'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['action', '-created_at']),
            models.Index(fields=['is_critical', '-created_at']),
            models.Index(fields=['actor', '-created_at']),
        ]

    def __str__(self):
        return f'{self.action_label} · {self.actor_username or "—"} · {self.created_at:%Y-%m-%d %H:%M}'

    @property
    def action_label(self):
        return ACTION_LABELS.get(self.action, self.action)
