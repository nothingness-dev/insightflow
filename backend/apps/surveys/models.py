import os
import uuid
import secrets
import string
from datetime import timedelta
from django.db import models
from django.conf import settings
from django.core.validators import MaxLengthValidator, MinValueValidator, MaxValueValidator
from django.utils import timezone


def person_photo_upload_path(instance, filename):
    ext = filename.rsplit('.', 1)[-1].lower()
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    return os.path.join('people', new_filename)


def generate_hash_token():
    """Generate a 12-char alphanumeric token (mix of letters and digits)."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(12))


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
    person = models.ForeignKey(
        'SurveyPerson', on_delete=models.CASCADE, null=True, blank=True,
        related_name='custom_questions', verbose_name='سوال اختصاصی برای فرد'
    )
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ به‌روزرسانی')

    class Meta:
        verbose_name = 'سوال نظرسنجی'
        verbose_name_plural = 'سوال‌های نظرسنجی'
        ordering = ['display_order', 'created_at']
        indexes = [
            # Hot path: effective_questions_for_person() resolves each
            # person's assigned questions on every list/detail/rating call.
            models.Index(
                fields=['survey', 'is_active', 'person', 'display_order'],
                name='surveyq_active_person_idx',
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(has_score=True)
                    | models.Q(has_comment=True)
                    | models.Q(has_emoji=True)
                ),
                name='surveyq_has_answer_type',
            ),
            models.CheckConstraint(
                condition=models.Q(has_score=True) | models.Q(score_required=False),
                name='surveyq_score_req_enabled',
            ),
            models.CheckConstraint(
                condition=models.Q(has_comment=True) | models.Q(comment_required=False),
                name='surveyq_comment_req_enabled',
            ),
            models.CheckConstraint(
                condition=models.Q(has_emoji=True) | models.Q(emoji_required=False),
                name='surveyq_emoji_req_enabled',
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(has_score=True, has_comment=False, has_emoji=False)
                    | models.Q(score_required=True)
                ),
                name='surveyq_single_score_req',
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(has_score=False, has_comment=True, has_emoji=False)
                    | models.Q(comment_required=True)
                ),
                name='surveyq_single_comment_req',
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(has_score=False, has_comment=False, has_emoji=True)
                    | models.Q(emoji_required=True)
                ),
                name='surveyq_single_emoji_req',
            ),
        ]

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
    uses_default_questions = models.BooleanField(default=True, verbose_name='استفاده از سوال‌های پیش‌فرض')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ایجاد')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ به‌روزرسانی')

    class Meta:
        verbose_name = 'شخص'
        verbose_name_plural = 'افراد'
        ordering = ['display_order', 'created_at']
        indexes = [
            # Hot path: active people per survey drive list counters,
            # required-pair totals, and public serializers.
            models.Index(fields=['survey', 'is_active'], name='surveyp_survey_active_idx'),
        ]

    def __str__(self):
        return f"{self.full_name} - {self.survey.title}"


class SurveyHashLink(models.Model):
    """An anonymous participation link for a survey.

    Anyone with the link can participate without logging in.
    The anonymous_participant_count tracks devices registered through this
    link (incremented at each device's first ballot, not at completion).
    """
    survey = models.ForeignKey(
        Survey, on_delete=models.CASCADE,
        related_name='hash_links', verbose_name='نظرسنجی'
    )
    token = models.CharField(
        max_length=32, unique=True, db_index=True, verbose_name='توکن هش'
    )
    label = models.CharField(max_length=200, blank=True, verbose_name='برچسب')
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='فعال')
    anonymous_participant_count = models.PositiveIntegerField(
        default=0, verbose_name='تعداد شرکت‌کنندگان ناشناس'
    )
    max_participants = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='حداکثر تعداد شرکت‌کنندگان',
        validators=[MinValueValidator(1)],
    )

    EXPIRY_UNIT_HOURS = 'hours'
    EXPIRY_UNIT_DAYS = 'days'
    EXPIRY_UNIT_WEEKS = 'weeks'
    EXPIRY_UNIT_CHOICES = [
        (EXPIRY_UNIT_HOURS, 'ساعت'),
        (EXPIRY_UNIT_DAYS, 'روز'),
        (EXPIRY_UNIT_WEEKS, 'هفته'),
    ]
    expiry_value = models.PositiveIntegerField(
        null=True, blank=True, verbose_name='مقدار انقضا',
        validators=[MinValueValidator(1), MaxValueValidator(1000)],
    )
    expiry_unit = models.CharField(
        max_length=10, choices=EXPIRY_UNIT_CHOICES, null=True, blank=True,
        verbose_name='واحد انقضا',
    )
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name='زمان انقضا')

    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ایجاد')

    class Meta:
        verbose_name = 'لینک هش'
        verbose_name_plural = 'لینک‌های هش'
        ordering = ['-created_at']

    def __str__(self):
        return f"لینک {self.token} - {self.survey.title}"

    def _compute_expires_at(self):
        if not self.expiry_value or not self.expiry_unit:
            return None
        base = self.created_at or timezone.now()
        if self.expiry_unit == self.EXPIRY_UNIT_HOURS:
            delta = timedelta(hours=self.expiry_value)
        elif self.expiry_unit == self.EXPIRY_UNIT_DAYS:
            delta = timedelta(days=self.expiry_value)
        elif self.expiry_unit == self.EXPIRY_UNIT_WEEKS:
            delta = timedelta(weeks=self.expiry_value)
        else:
            return None
        return base + delta

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = generate_hash_token()
            while SurveyHashLink.objects.filter(token=self.token).exists():
                self.token = generate_hash_token()
        self.expires_at = self._compute_expires_at()
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return bool(self.expires_at and timezone.now() >= self.expires_at)

    @property
    def is_full(self):
        return bool(self.max_participants and self.anonymous_participant_count >= self.max_participants)

    @property
    def is_usable(self):
        return self.is_active and not self.is_expired and not self.is_full


class AnonymousParticipation(models.Model):
    """Device registration for an anonymous hash-link session.

    Created when a device (client IP) casts its first ballot through a link,
    binding the IP to the client-side anonymous_token. Any later ballot from
    the same IP must present the same token, so one device can never spread
    ballots across multiple tokens. finished_at marks the moment every
    required question of the survey was answered; completed_at stays the
    first-ballot registration time.
    """
    survey = models.ForeignKey(
        Survey, on_delete=models.CASCADE,
        related_name='anonymous_participations', verbose_name='نظرسنجی'
    )
    hash_link = models.ForeignKey(
        SurveyHashLink, on_delete=models.CASCADE,
        related_name='participations', verbose_name='لینک هش'
    )
    ip_address = models.GenericIPAddressField(verbose_name='آدرس IP')
    anonymous_token = models.CharField(max_length=64, blank=True, verbose_name='توکن ناشناس')
    user_agent = models.TextField(blank=True, verbose_name='مرورگر')
    completed_at = models.DateTimeField(default=timezone.now, verbose_name='زمان ثبت')
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name='زمان تکمیل')

    class Meta:
        verbose_name = 'مشارکت ناشناس'
        verbose_name_plural = 'مشارکت‌های ناشناس'
        ordering = ['-completed_at']
        indexes = [
            models.Index(fields=['survey', 'ip_address'], name='anon_part_survey_ip_idx'),
            models.Index(fields=['hash_link', 'ip_address'], name='anon_part_link_ip_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['survey', 'hash_link', 'ip_address'],
                name='unique_anonymous_ip_per_link',
            ),
        ]

    def __str__(self):
        return f"{self.ip_address} - {self.survey.title}"


class Rating(models.Model):
    EMOJI_BAD = 'bad'
    EMOJI_AVERAGE = 'average'
    EMOJI_GOOD = 'good'
    EMOJI_EXCELLENT = 'excellent'

    EMOJI_CHOICES = [
        (EMOJI_BAD, 'ضعیف'),
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
        related_name='ratings', verbose_name='رأی‌دهنده',
        null=True, blank=True,
    )
    anonymous_token = models.CharField(
        max_length=64, null=True, blank=True,
        verbose_name='توکن ناشناس', db_index=True,
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
        validators=[MaxLengthValidator(1000)],
        verbose_name='توضیحات'
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='آدرس IP')
    user_agent = models.TextField(null=True, blank=True, verbose_name='مرورگر')
    created_at = models.DateTimeField(default=timezone.now, verbose_name='تاریخ ثبت')

    def clean(self):
        """Guard for django-admin and other full_clean() paths: a rating must
        carry at least one answer component, otherwise it silently poisons
        averages. The app's serializer path already enforces this."""
        from django.core.exceptions import ValidationError
        has_comment = bool(self.comment)
        if self.score is None and not self.emoji_rating and not has_comment:
            raise ValidationError('هر پاسخ باید حداقل یک نوع پاسخ داشته باشد.')
        super().clean()

    class Meta:
        verbose_name = 'پاسخ'
        verbose_name_plural = 'پاسخ‌ها'
        indexes = [
            models.Index(fields=['survey', 'voter'], name='rating_survey_voter_idx'),
            models.Index(fields=['survey', 'person'], name='rating_survey_person_idx'),
            models.Index(fields=['survey', 'anonymous_token'], name='rating_survey_anon_idx'),
            models.Index(fields=['survey', 'ip_address'], name='rating_survey_ip_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['survey', 'person', 'question', 'voter'],
                condition=models.Q(voter__isnull=False),
                name='rating_unique_voter',
            ),
            models.UniqueConstraint(
                fields=['survey', 'person', 'question', 'anonymous_token'],
                condition=models.Q(anonymous_token__isnull=False),
                name='rating_unique_anonymous',
            ),
        ]

    def __str__(self):
        if self.score is not None:
            value = self.score
        elif self.emoji_rating:
            value = self.get_emoji_rating_display()
        else:
            value = 'متنی'
        return f"پاسخ {value} برای {self.person.full_name}"
