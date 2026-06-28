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

    VISIBILITY_CHOICES = [
        (VISIBILITY_ADMIN_ONLY, 'فقط مدیر'),
    ]

    title = models.CharField(max_length=300, verbose_name='عنوان')
                                                                                
                                                                    
    question = models.TextField(blank=True, default='', verbose_name='سوال اصلی قدیمی')
    description = models.TextField(blank=True, verbose_name='توضیحات')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, verbose_name='وضعیت')
    results_visibility = models.CharField(
        max_length=30, choices=VISIBILITY_CHOICES,
        default=VISIBILITY_ADMIN_ONLY, verbose_name='نمایش نتایج'
    )
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
        return self.status == self.STATUS_PUBLISHED

    def can_vote(self):
        return self.is_active


class SurveyQuestion(models.Model):
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='questions', verbose_name='نظرسنجی')
    text = models.TextField(verbose_name='متن سوال')
    help_text = models.TextField(blank=True, verbose_name='راهنمای سوال')
    has_score = models.BooleanField(default=True, verbose_name='دارای امتیاز عددی')
    score_required = models.BooleanField(default=True, verbose_name='امتیاز عددی الزامی است')
    has_comment = models.BooleanField(default=False, verbose_name='دارای توضیح متنی')
    comment_required = models.BooleanField(default=False, verbose_name='توضیح متنی الزامی است')
    has_emoji = models.BooleanField(default=False, verbose_name='دارای امتیاز ایموجی')
    emoji_required = models.BooleanField(default=False, verbose_name='امتیاز ایموجی الزامی است')
    display_order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
    is_active = models.BooleanField(default=True, verbose_name='فعال')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ به‌روزرسانی')

    class Meta:
        verbose_name = 'سوال نظرسنجی'
        verbose_name_plural = 'سوال‌های نظرسنجی'
        ordering = ['display_order', 'created_at']

    def __str__(self):
        return f'{self.text[:60]} - {self.survey.title}'


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
    EMOJI_BAD = 'bad'
    EMOJI_AVERAGE = 'average'
    EMOJI_GOOD = 'good'
    EMOJI_EXCELLENT = 'excellent'

    EMOJI_CHOICES = [
        (EMOJI_BAD, 'بد'),
        (EMOJI_AVERAGE, 'متوسط'),
        (EMOJI_GOOD, 'خوب'),
        (EMOJI_EXCELLENT, 'عالی'),
    ]

    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='ratings', verbose_name='نظرسنجی')
    person = models.ForeignKey(SurveyPerson, on_delete=models.CASCADE, related_name='ratings', verbose_name='شخص')
    question = models.ForeignKey(
        SurveyQuestion, on_delete=models.CASCADE,
        related_name='ratings', verbose_name='سوال'
    )
    voter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='ratings', verbose_name='رأی‌دهنده'
    )
    score = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        verbose_name='امتیاز'
    )
    emoji_rating = models.CharField(
        max_length=20, choices=EMOJI_CHOICES, null=True, blank=True,
        verbose_name='امتیاز ایموجی'
    )
    comment = models.TextField(
        blank=True, null=True,
        verbose_name='توضیحات'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='آدرس IP')
    user_agent = models.TextField(null=True, blank=True, verbose_name='مرورگر')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ثبت')

    class Meta:
        verbose_name = 'پاسخ'
        verbose_name_plural = 'پاسخ‌ها'
        unique_together = [('survey', 'person', 'question', 'voter')]
        indexes = [
            models.Index(fields=['survey', 'voter'],  name='rating_survey_voter_idx'),
            models.Index(fields=['survey', 'person'], name='rating_survey_person_idx'),
        ]

    def __str__(self):
        if self.score is not None:
            value = self.score
        elif self.emoji_rating:
            value = self.get_emoji_rating_display()
        else:
            value = 'متنی'
        return f"پاسخ {value} برای {self.person.full_name}"
