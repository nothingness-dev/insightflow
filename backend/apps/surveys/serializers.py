import os
from rest_framework import serializers
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from .models import Survey, SurveyPerson, Rating


def validate_photo(file):
    if file:
        ext = file.name.rsplit('.', 1)[-1].lower()
        if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
            raise serializers.ValidationError('فقط فرمت‌های jpg, jpeg, png, webp مجاز هستند.')
        if file.size > settings.MAX_UPLOAD_SIZE:
            raise serializers.ValidationError(f'حجم فایل نباید از {settings.MAX_UPLOAD_SIZE // 1024 // 1024} مگابایت بیشتر باشد.')
        # Validate MIME type via content type
        allowed_mime = ['image/jpeg', 'image/png', 'image/webp']
        if hasattr(file, 'content_type') and file.content_type not in allowed_mime:
            raise serializers.ValidationError('نوع فایل مجاز نیست.')
    return file


class SurveyPersonSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = SurveyPerson
        fields = [
            'id', 'survey', 'full_name', 'photo', 'photo_url',
            'role_title', 'department', 'description',
            'display_order', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'photo_url']
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


class SurveyPersonPublicSerializer(serializers.ModelSerializer):
    """نسخه عمومی برای نمایش به کارکنان - بدون اطلاعات حساس"""
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = SurveyPerson
        fields = ['id', 'full_name', 'photo_url', 'role_title', 'department', 'description', 'display_order']

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
    total_responses = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            'id', 'title', 'question', 'description', 'status',
            'results_visibility',
            'created_by', 'created_by_name', 'people_count', 'total_responses',
            'created_at', 'updated_at', 'published_at', 'closed_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'published_at', 'closed_at', 'created_by']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else None

    def get_people_count(self, obj):
        return obj.people.filter(is_active=True).count()

    def get_total_responses(self, obj):
        return obj.ratings.count()


class SurveyCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Survey
        fields = [
            'title', 'question', 'description', 'results_visibility',
        ]


class RatingCreateSerializer(serializers.Serializer):
    score = serializers.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(10)])
    comment = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=1000)


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


class SurveyPublicSerializer(serializers.ModelSerializer):
    """نسخه عمومی برای کارکنان"""
    people = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = Survey
        fields = [
            'id', 'title', 'question', 'description', 'status',
            'is_active', 'people'
        ]

    def get_people(self, obj):
        active_people = obj.people.filter(is_active=True)
        return SurveyPersonPublicSerializer(active_people, many=True, context=self.context).data
