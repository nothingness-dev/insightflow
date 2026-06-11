from django.contrib import admin
from .models import Survey, SurveyPerson, Rating


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ['title', 'status', 'created_by', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'question']


@admin.register(SurveyPerson)
class SurveyPersonAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'survey', 'department', 'is_active']
    list_filter = ['is_active', 'survey']


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ['person', 'survey', 'score', 'created_at']
    list_filter = ['survey', 'score']
    # Never show voter in list to enforce privacy model
    exclude = ['voter', 'ip_address', 'user_agent']
