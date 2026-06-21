from django.urls import path

from . import views

urlpatterns = [
    path('admin/activity/logs/', views.ActivityLogListView.as_view(), name='activity-logs'),
    path('admin/activity/stats/', views.ActivityStatsView.as_view(), name='activity-stats'),
    path('admin/activity/timeline/', views.ActivityTimelineView.as_view(), name='activity-timeline'),
    path('admin/activity/critical/', views.ActivityCriticalView.as_view(), name='activity-critical'),
    path('admin/activity/charts/', views.ActivityChartsView.as_view(), name='activity-charts'),
    path('admin/activity/filters/', views.ActivityFilterOptionsView.as_view(), name='activity-filters'),
    path('admin/activity/export/', views.ActivityExportView.as_view(), name='activity-export'),
]
