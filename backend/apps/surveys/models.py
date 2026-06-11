import os
import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


def person_photo_upload_path(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower()
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('people', new_filename)


class Survey(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_PUBLISHED = 'published'
    STATUS_CLOSED = 'closed'

    STATUS_CHOICES = [
        (STATUS_DRAFT, 'پیش‌نویس'),
        (STATUS_PUBLISHED, 'منتشر شده'),
        (STATUS_CLOSED, 'بسته شده'),
    ]

    VISIBILITY_ADMIN_ONLY = 'admin_only'
    VISIBILITY_EMPLOYEES_AFTER_CLOSE = 'employees_after_close'
    VISIBILITY_PUBLIC_AFTER_CLOSE = 'public_after_close'

    VISIBILITY_CHOICES = [
        (VISIBILITY_ADMIN_ONLY, 'فقط مدیر'),
        (VISIBILITY_EMPLOYEES_AFTER_CLOSE, 'کارکنان پس از بسته شدن'),
        (VISIBILITY_PUBLIC_AFTER_CLOSE, 'عمومی پس از بسته شدن'),
    ]

    title = models.CharField(max_length=300, verbose_name='عنوان')
    question = models.TextField(verbose_name='سوال اصلی')
    description = models.TextField(blank=True, verbose_name='توضیحات')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, verbose_name='وضعیت')
    results_visibility = models.CharField(
        max_length=30, choices=VISIBILITY_CHOICES,
        default=VISIBILITY_ADMIN_ONLY, verbose_name='نمایش نتایج'
    )
    starts_at = models.DateTimeField(null=True, blank=True, verbose_name='تاریخ شروع')
    ends_at = models.DateTimeField(null=True, blank=True, verbose_name='تاریخ پایان')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='created_surveys', verbose_name='ایجادکننده'
    )
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ به‌روزرسانی')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='تاریخ انتشار')
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name='تاریخ بستن')

    class Meta:
        verbose_name = 'نظرسنجی'
        verbose_name_plural = 'نظرسنجی‌ها'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    @property
    def is_active(self):
        now = timezone.now()
        if self.status != self.STATUS_PUBLISHED:
            return False
        if self.starts_at and now < self.starts_at:
            return False
        if self.ends_at and now > self.ends_at:
            return False
        return True

    def can_vote(self):
        return self.is_active


class SurveyPerson(models.Model):
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='people', verbose_name='نظرسنجی')
    full_name = models.CharField(max_length=200, verbose_name='نام و نام خانوادگی')
    photo = models.ImageField(upload_to=person_photo_upload_path, null=True, blank=True, verbose_name='تصویر')
    role_title = models.CharField(max_length=200, blank=True, verbose_name='سمت')
    department = models.CharField(max_length=200, blank=True, verbose_name='واحد سازمانی')
    description = models.TextField(blank=True, verbose_name='توضیحات')
    display_order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ به‌روزرسانی')

    class Meta:
        verbose_name = 'شخص'
        verbose_name_plural = 'افراد'
        ordering = ['display_order', 'created_at']

    def __str__(self):
        return f"{self.full_name} - {self.survey.title}"


class Rating(models.Model):
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='ratings', verbose_name='نظرسنجی')
    person = models.ForeignKey(SurveyPerson, on_delete=models.CASCADE, related_name='ratings', verbose_name='شخص')
    voter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='ratings', verbose_name='رأی‌دهنده'
    )
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        verbose_name='امتیاز'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='آدرس IP')
    user_agent = models.TextField(null=True, blank=True, verbose_name='مرورگر')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ثبت')

    class Meta:
        verbose_name = 'امتیاز'
        verbose_name_plural = 'امتیازها'
        unique_together = [('survey', 'person', 'voter')]

    def __str__(self):
        return f"امتیاز {self.score} برای {self.person.full_name}"
