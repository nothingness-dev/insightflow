from django.contrib import admin
from .models import Survey, SurveyQuestion, SurveyPerson, Rating


class SurveyQuestionInline(admin.TabularInline):
    model = SurveyQuestion
    extra = 0


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'created_by', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'question', 'questions__text']
    inlines = [SurveyQuestionInline]


@admin.register(SurveyQuestion)
class SurveyQuestionAdmin(admin.ModelAdmin):
    list_display = ['text', 'survey', 'has_score', 'score_required', 'has_comment', 'comment_required',
                     'has_emoji', 'emoji_required', 'is_active']
    list_filter = ['survey', 'has_score', 'has_comment', 'has_emoji', 'is_active']
    search_fields = ['text', 'survey__title']


@admin.register(SurveyPerson)
class SurveyPersonAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'survey', 'department', 'is_active']
    list_filter = ['is_active', 'survey']


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ['person', 'question', 'survey', 'score', 'emoji_rating', 'created_at']
    list_filter = ['survey', 'question', 'score', 'emoji_rating']
                                                       
    exclude = ['voter', 'ip_address', 'user_agent']
