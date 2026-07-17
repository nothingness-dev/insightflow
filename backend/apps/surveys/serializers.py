from rest_framework import serializers
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Count
from django.utils import timezone
from .models import Survey, SurveyQuestion, SurveyPerson, Rating, SurveyHashLink


def validate_photo(file):
    if file:
        ext = file.name.rsplit('.', 1)[-1].lower()
        if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
            raise serializers.ValidationError('فقط فرمت‌های jpg, jpeg, png, webp مجاز هستند.')
        if file.size > settings.MAX_UPLOAD_SIZE:
            raise serializers.ValidationError(f'حجم فایل نباید از {settings.MAX_UPLOAD_SIZE // 1024 // 1024} مگابایت بیشتر باشد.')
        allowed_mime = ['image/jpeg', 'image/png', 'image/webp']
        if hasattr(file, 'content_type') and file.content_type not in allowed_mime:
            raise serializers.ValidationError('نوع فایل مجاز نیست.')
    return file


class SurveyQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyQuestion
        fields = [
            'id', 'survey', 'person', 'text', 'help_text', 'has_score', 'score_required',
            'has_comment', 'comment_required', 'has_emoji', 'emoji_required',
            'display_order', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'survey', 'person', 'created_at']

    def validate(self, attrs):
        has_score = attrs.get('has_score', getattr(self.instance, 'has_score', True))
        has_comment = attrs.get('has_comment', getattr(self.instance, 'has_comment', False))
        has_emoji = attrs.get('has_emoji', getattr(self.instance, 'has_emoji', False))
        score_required = attrs.get('score_required', getattr(self.instance, 'score_required', True))
        comment_required = attrs.get('comment_required', getattr(self.instance, 'comment_required', False))
        emoji_required = attrs.get('emoji_required', getattr(self.instance, 'emoji_required', False))
        text = attrs.get('text', getattr(self.instance, 'text', '')).strip()

        if not text:
            raise serializers.ValidationError({'text': 'متن سوال الزامی است.'})
        if not has_score and not has_comment and not has_emoji:
            raise serializers.ValidationError('هر سوال باید حداقل یک نوع پاسخ (امتیاز عددی، امتیاز ایموجی یا توضیح متنی) داشته باشد.')
        if not has_score:
            attrs['score_required'] = False
            score_required = False
        if not has_comment:
            attrs['comment_required'] = False
            comment_required = False
        if not has_emoji:
            attrs['emoji_required'] = False
            emoji_required = False
        if score_required and not has_score:
            raise serializers.ValidationError({'score_required': 'وقتی امتیاز عددی غیرفعال است، الزامی بودن امتیاز مجاز نیست.'})
        if comment_required and not has_comment:
            raise serializers.ValidationError({'comment_required': 'وقتی توضیح متنی غیرفعال است، الزامی بودن توضیح مجاز نیست.'})
        if emoji_required and not has_emoji:
            raise serializers.ValidationError({'emoji_required': 'وقتی امتیاز ایموجی غیرفعال است، الزامی بودن آن مجاز نیست.'})
        return attrs


class SurveyQuestionPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyQuestion
        fields = [
            'id', 'text', 'help_text', 'has_score', 'score_required',
            'has_comment', 'comment_required', 'has_emoji', 'emoji_required',
            'display_order'
        ]


class SurveyPersonSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    question_ids = serializers.SerializerMethodField()
    questions = serializers.SerializerMethodField()

    class Meta:
        model = SurveyPerson
        fields = [
            'id', 'survey', 'full_name', 'photo', 'photo_url',
            'role_title', 'department', 'description',
            'display_order', 'is_active', 'uses_default_questions', 'question_ids', 'questions', 'created_at'
        ]
        # `uses_default_questions` is intentionally read-only here: it must only
        # ever change via AdminPersonQuestionsView (dedicated endpoint), never
        # through person create/update. This also sidesteps a DRF BooleanField
        # gotcha - form/multipart submissions that omit a boolean field are
        # treated as an explicit False (BooleanField.default_empty_html=False),
        # which silently forced every newly created person into "custom" mode.
        read_only_fields = ['id', 'created_at', 'photo_url', 'uses_default_questions']
        extra_kwargs = {'photo': {'write_only': True, 'required': False}, 'survey': {'read_only': True}}

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def validate_photo(self, value):
        return validate_photo(value)

    def get_question_ids(self, obj):
        from .services import effective_questions_for_person
        return list(effective_questions_for_person(obj).values_list('id', flat=True))

    def get_questions(self, obj):
        # Full question objects currently in effect for this person (shared
        # pool, or their own private questions) - the admin UI uses this to
        # pre-fill the per-person question editor with live data instead of
        # relying on a possibly-stale survey-level question list.
        from .services import effective_questions_for_person
        return SurveyQuestionSerializer(effective_questions_for_person(obj), many=True, context=self.context).data


class SurveyPersonPublicSerializer(serializers.ModelSerializer):
    """نسخه عمومی برای نمایش به کارکنان - بدون اطلاعات حساس"""
    photo_url = serializers.SerializerMethodField()
    question_ids = serializers.SerializerMethodField()
    questions = serializers.SerializerMethodField()

    class Meta:
        model = SurveyPerson
        fields = ['id', 'full_name', 'photo_url', 'role_title', 'department', 'description', 'display_order', 'question_ids', 'questions']

    def get_question_ids(self, obj):
        from .services import effective_questions_for_person
        return list(effective_questions_for_person(obj).values_list('id', flat=True))

    def get_questions(self, obj):
        # Full question objects for this specific person - includes their own
        # private questions when they don't use the shared/default set, so
        # the voting form can render them even though the survey-level
        # `questions` list only carries the shared question pool.
        from .services import effective_questions_for_person
        return SurveyQuestionPublicSerializer(effective_questions_for_person(obj), many=True, context=self.context).data

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None


class SurveySerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    people_count = serializers.SerializerMethodField()
    questions_count = serializers.SerializerMethodField()
    total_responses = serializers.SerializerMethodField()
    anonymous_participants_count = serializers.SerializerMethodField()
    questions = SurveyQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Survey
        fields = [
            'id', 'title', 'question', 'description', 'status',
            'results_visibility', 'questions', 'questions_count',
            'created_by', 'created_by_name', 'people_count', 'total_responses',
            'anonymous_participants_count',
            'created_at', 'updated_at', 'published_at', 'closed_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'published_at', 'closed_at', 'created_by']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else None

    def get_people_count(self, obj):
        return obj.people.filter(is_active=True).count()

    def get_questions_count(self, obj):
        return obj.questions.filter(is_active=True).count()

    def get_total_responses(self, obj):
        """Count authenticated voters who fully completed the survey."""
        from .services import completed_participants
        voter_ids, _anonymous = completed_participants(obj)
        return len(voter_ids)

    def get_anonymous_participants_count(self, obj):
        """Sum of anonymous_participant_count across all hash links for this survey."""
        from django.db.models import Sum
        result = obj.hash_links.aggregate(total=Sum('anonymous_participant_count'))
        return result['total'] or 0


class SurveyCreateUpdateSerializer(serializers.ModelSerializer):
    questions = SurveyQuestionSerializer(many=True, required=False)
    question = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Survey
        fields = [
            'title', 'question', 'description', 'results_visibility', 'questions',
        ]

    def validate(self, attrs):
        questions = attrs.get('questions')
        legacy_question = (attrs.get('question') or '').strip()

        if questions is None:
            if self.instance is not None:
                return attrs
            if legacy_question:
                return attrs
            raise serializers.ValidationError({'questions': 'حداقل یک سوال فعال برای نظرسنجی الزامی است.'})

        active_questions = [q for q in questions if q.get('is_active', True)]
        if not active_questions:
            raise serializers.ValidationError({'questions': 'حداقل یک سوال فعال برای نظرسنجی الزامی است.'})
        return attrs

    def create(self, validated_data):
        questions_data = validated_data.pop('questions', None)
        legacy_question = validated_data.pop('question', '').strip()
        if questions_data is None and legacy_question:
            questions_data = [{
                'text': legacy_question,
                'help_text': '',
                'has_score': True,
                'score_required': True,
                'has_comment': True,
                'comment_required': False,
                'has_emoji': False,
                'emoji_required': False,
                'display_order': 0,
                'is_active': True,
            }]
        questions_data = questions_data or []
        first_question = questions_data[0]['text'] if questions_data else legacy_question
        survey = Survey.objects.create(question=first_question, **validated_data)
        self._save_questions(survey, questions_data)
        return survey

    def update(self, instance, validated_data):
        questions_data = validated_data.pop('questions', None)
        legacy_question = validated_data.pop('question', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if questions_data is not None and questions_data:
            instance.question = questions_data[0]['text']
        elif legacy_question is not None:
            instance.question = legacy_question.strip()
        instance.save()
        if questions_data is not None:
            self._save_questions(instance, questions_data)
        elif legacy_question is not None and not instance.questions.filter(is_active=True).exists():
            self._save_questions(instance, [{
                'text': legacy_question.strip() or 'سوال اصلی',
                'help_text': '',
                'has_score': True,
                'score_required': True,
                'has_comment': True,
                'comment_required': False,
                'has_emoji': False,
                'emoji_required': False,
                'display_order': 0,
                'is_active': True,
            }])
        return instance

    def _save_questions(self, survey, questions_data):
        existing_by_id = {q.id: q for q in survey.questions.all()}
        seen_ids = set()

        for index, item in enumerate(questions_data):
            item = dict(item)
            question_id = item.pop('id', None)
            item.setdefault('display_order', index)
            item.setdefault('is_active', True)

            if question_id and question_id in existing_by_id:
                question = existing_by_id[question_id]
                for attr, value in item.items():
                    setattr(question, attr, value)
                question.save()
                seen_ids.add(question_id)
            else:
                SurveyQuestion.objects.create(survey=survey, **item)

                                                                              
                                                                       
        for question_id, question in existing_by_id.items():
            if question_id not in seen_ids:
                question.is_active = False
                question.save(update_fields=['is_active', 'updated_at'])


class QuestionAnswerCreateSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    score = serializers.IntegerField(required=False, allow_null=True, validators=[MinValueValidator(1), MaxValueValidator(10)])
    emoji_rating = serializers.ChoiceField(choices=Rating.EMOJI_CHOICES, required=False, allow_null=True)
    comment = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=1000)


class RatingCreateSerializer(serializers.Serializer):
    answers = QuestionAnswerCreateSerializer(many=True, required=False)
                                                                               
    score = serializers.IntegerField(required=False, allow_null=True, validators=[MinValueValidator(1), MaxValueValidator(10)])
    emoji_rating = serializers.ChoiceField(choices=Rating.EMOJI_CHOICES, required=False, allow_null=True)
    comment = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=1000)

    def validate(self, attrs):
        if attrs.get('answers'):
            return attrs
        if 'score' in attrs or 'comment' in attrs or 'emoji_rating' in attrs:
            return attrs
        raise serializers.ValidationError({'answers': 'پاسخ به سوال‌ها الزامی است.'})


class PersonResultSerializer(serializers.Serializer):
    """نتایج ناشناس - بدون هیچ اطلاعات رأی‌دهنده"""
    rank = serializers.IntegerField()
    person_id = serializers.IntegerField()
    full_name = serializers.CharField()
    photo_url = serializers.CharField(allow_null=True)
    department = serializers.CharField()
    role_title = serializers.CharField()
    average_score = serializers.FloatField(allow_null=True)
    total_score = serializers.IntegerField()
    votes_count = serializers.IntegerField()
    comments = serializers.ListField(child=serializers.CharField(), required=False)
    question_results = serializers.ListField(required=False)


class SurveyPublicSerializer(serializers.ModelSerializer):
    """نسخه عمومی برای کارکنان"""
    people = serializers.SerializerMethodField()
    questions = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Survey
        fields = [
            'id', 'title', 'question', 'description', 'status',
            'is_active', 'questions', 'people'
        ]

    def get_people(self, obj):
        active_people = obj.people.filter(is_active=True)
        return SurveyPersonPublicSerializer(active_people, many=True, context=self.context).data

    def get_questions(self, obj):
        # Only the shared/default question pool - a particular person's
        # private questions are never mixed into this general list, they
        # only surface through that person's own `questions`/`question_ids`.
        active_questions = obj.questions.filter(is_active=True, person__isnull=True)
        return SurveyQuestionPublicSerializer(active_questions, many=True, context=self.context).data


class PendingEmployeeProgressSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    full_name = serializers.CharField()


class SurveyProgressSerializer(serializers.Serializer):
    survey_id = serializers.IntegerField()
    title = serializers.CharField()
    status = serializers.CharField()
    active_people_count = serializers.IntegerField()
    active_questions_count = serializers.IntegerField()
    tracking_enabled = serializers.BooleanField()
    assigned_employees = serializers.IntegerField()
    completed_employees = serializers.IntegerField()
    anonymous_participants = serializers.IntegerField(default=0)
    pending_employees = serializers.IntegerField()
    completion_percentage = serializers.FloatField()
    pending_users = PendingEmployeeProgressSerializer(many=True)


class SurveyProgressSummarySerializer(serializers.Serializer):
    total_surveys = serializers.IntegerField()
    total_assigned_responses = serializers.IntegerField()
    total_completed_responses = serializers.IntegerField()
    total_anonymous_participants = serializers.IntegerField(default=0)
    total_pending_responses = serializers.IntegerField()
    overall_completion_percentage = serializers.FloatField()


class SurveyProgressDashboardSerializer(serializers.Serializer):
    summary = SurveyProgressSummarySerializer()
    surveys = SurveyProgressSerializer(many=True)


class SurveyHashLinkSerializer(serializers.ModelSerializer):
    is_expired = serializers.BooleanField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)

    class Meta:
        model = SurveyHashLink
        fields = [
            'id', 'survey', 'token', 'label',
            'is_active', 'anonymous_participant_count', 'created_at',
            'max_participants', 'expiry_value', 'expiry_unit', 'expires_at',
            'is_expired', 'is_full',
        ]
        read_only_fields = [
            'id', 'survey', 'token', 'anonymous_participant_count', 'created_at',
            'expires_at', 'is_expired', 'is_full',
        ]

    def validate_label(self, value):
        return value.strip()

    def validate_max_participants(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError('حداقل تعداد شرکت‌کنندگان باید ۱ نفر باشد.')
        if (
            value is not None
            and self.instance is not None
            and value <= self.instance.anonymous_participant_count
        ):
            raise serializers.ValidationError('محدودیت باید بیشتر از تعداد شرکت‌کنندگان ناشناس فعلی باشد.')
        return value

    def validate_expiry_value(self, value):
        if value is not None and not (1 <= value <= 1000):
            raise serializers.ValidationError('مقدار انقضا باید بین ۱ تا ۱۰۰۰ باشد.')
        return value

    def validate(self, attrs):
        # expiry_value and expiry_unit must be set/cleared together.
        has_value = 'expiry_value' in attrs
        has_unit = 'expiry_unit' in attrs
        value = attrs.get('expiry_value', getattr(self.instance, 'expiry_value', None) if self.instance else None)
        unit = attrs.get('expiry_unit', getattr(self.instance, 'expiry_unit', None) if self.instance else None)
        if (has_value or has_unit) and bool(value) != bool(unit):
            raise serializers.ValidationError({
                'expiry_value': 'برای تعیین انقضا باید هم مقدار و هم واحد زمانی مشخص شود، یا هر دو خالی بمانند.'
            })
        if self.instance is not None and value and unit:
            if unit == SurveyHashLink.EXPIRY_UNIT_WEEKS:
                expiry_hours = value * 7 * 24
            elif unit == SurveyHashLink.EXPIRY_UNIT_DAYS:
                expiry_hours = value * 24
            else:
                expiry_hours = value
            elapsed_hours = int((timezone.now() - self.instance.created_at).total_seconds() // 3600) + 1
            if expiry_hours < max(1, elapsed_hours):
                raise serializers.ValidationError({
                    'expiry_value': 'مهلت انقضا باید بیشتر از زمان گذشته از ایجاد لینک باشد.'
                })
        return attrs
