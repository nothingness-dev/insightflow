"""Activity / audit logging models.

This app records system & admin activities across the whole application so an
administrator can review *who did what, and when* from a single Activity Center.

Security policy (enforced by the service layer in ``services.py``):
  * We NEVER store passwords, tokens, session keys or raw request bodies.
  * Only a small, explicitly-built, human-readable description plus a bounded,
    sanitised ``metadata`` dict is persisted.

The table is designed for scale (1000+ rows): every column used for filtering,
searching or ordering is indexed, and the API layer always paginates and never
loads the whole table at once.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone


class ActivityActions:
    """Canonical action codes recorded in the audit log.

    Keep these stable — they are stored in the database and referenced by the
    frontend filter dropdown.
    """

    # auth
    LOGIN = 'login'
    LOGIN_FAILED = 'login_failed'
    LOGOUT = 'logout'
    PASSWORD_CHANGE = 'password_change'
    PASSWORD_RESET = 'password_reset'

    # user management
    USER_CREATE = 'user_create'
    USER_EDIT = 'user_edit'
    USER_DELETE = 'user_delete'
    USER_ACTIVATE = 'user_activate'
    USER_DEACTIVATE = 'user_deactivate'
    BULK_IMPORT = 'bulk_employee_import'

    # surveys
    SURVEY_CREATE = 'survey_create'
    SURVEY_EDIT = 'survey_edit'
    SURVEY_DELETE = 'survey_delete'
    SURVEY_DUPLICATE = 'survey_duplicate'
    SURVEY_PUBLISH = 'survey_publish'
    SURVEY_CLOSE = 'survey_close'

    # questions
    QUESTION_ADD = 'question_add'
    QUESTION_EDIT = 'question_edit'
    QUESTION_DELETE = 'question_delete'

    # exports
    EXPORT_CSV = 'export_csv'
    EXPORT_EXCEL = 'export_excel'
    EXPORT_PDF = 'export_pdf'

    # destructive
    DELETE_ALL_DATA = 'delete_all_data'


# Persian, human-readable label for every action code.
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
}

ACTION_CHOICES = [(code, label) for code, label in ACTION_LABELS.items()]

# Actions considered sensitive / high-impact. They populate the dedicated
# "Critical Actions" panel and are highlighted in the table.
CRITICAL_ACTIONS = {
    ActivityActions.LOGIN_FAILED,
    ActivityActions.PASSWORD_RESET,
    ActivityActions.USER_DELETE,
    ActivityActions.USER_DEACTIVATE,
    ActivityActions.SURVEY_DELETE,
    ActivityActions.BULK_IMPORT,
    ActivityActions.DELETE_ALL_DATA,
}


class ActivityLog(models.Model):
    STATUS_SUCCESS = 'success'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_SUCCESS, 'موفق'),
        (STATUS_FAILED, 'ناموفق'),
    ]

    action = models.CharField(
        max_length=40, choices=ACTION_CHOICES, db_index=True, verbose_name='نوع فعالیت'
    )
    # The user who performed the action. SET_NULL so deleting a user keeps the
    # historical audit trail intact; the denormalised snapshot below preserves
    # who they were.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='activity_logs', verbose_name='کاربر'
    )
    actor_username = models.CharField(max_length=150, blank=True, db_index=True, verbose_name='نام کاربری')
    actor_full_name = models.CharField(max_length=200, blank=True, verbose_name='نام کامل')
    actor_role = models.CharField(max_length=20, blank=True, verbose_name='نقش')

    description = models.CharField(max_length=500, blank=True, verbose_name='شرح فعالیت')

    # Optional reference to the affected object (never a sensitive value).
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

    # Bounded, sanitised extra context (counts, names, statuses). The service
    # layer guarantees no secrets ever reach this field.
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
        return f'{self.get_action_display()} · {self.actor_username or "—"} · {self.created_at:%Y-%m-%d %H:%M}'

    @property
    def action_label(self):
        return ACTION_LABELS.get(self.action, self.action)
