from django.urls import path
from . import views

urlpatterns = [
    # Admin dashboard
    path('admin/dashboard/', views.AdminDashboardView.as_view(), name='admin-dashboard'),

    # Admin survey CRUD
    path('admin/surveys/', views.AdminSurveyListCreateView.as_view(), name='admin-survey-list'),
    path('admin/surveys/<int:pk>/', views.AdminSurveyDetailView.as_view(), name='admin-survey-detail'),
    path('admin/surveys/<int:pk>/publish/', views.AdminSurveyPublishView.as_view(), name='admin-survey-publish'),
    path('admin/surveys/<int:pk>/close/', views.AdminSurveyCloseView.as_view(), name='admin-survey-close'),
    path('admin/surveys/<int:pk>/results/', views.AdminSurveyResultsView.as_view(), name='admin-survey-results'),
    path('admin/surveys/<int:pk>/export/csv/', views.AdminSurveyExportCSVView.as_view(), name='admin-survey-export-csv'),
    path('admin/surveys/<int:pk>/export/excel/', views.AdminSurveyExportExcelView.as_view(), name='admin-survey-export-excel'),

    # Admin people management
    path('admin/surveys/<int:survey_id>/people/', views.AdminPersonListCreateView.as_view(), name='admin-person-list'),
    path('admin/people/<int:pk>/', views.AdminPersonDetailView.as_view(), name='admin-person-detail'),

    # Employee survey endpoints
    path('surveys/', views.EmployeeSurveyListView.as_view(), name='employee-survey-list'),
    path('surveys/<int:pk>/', views.EmployeeSurveyDetailView.as_view(), name='employee-survey-detail'),
    path('surveys/<int:survey_id>/people/<int:person_id>/rate/', views.EmployeeRatePersonView.as_view(), name='employee-rate-person'),
    path('surveys/<int:survey_id>/my-ratings/', views.EmployeeMyRatingsView.as_view(), name='employee-my-ratings'),
    path('surveys/<int:survey_id>/results/', views.EmployeeSurveyResultsView.as_view(), name='employee-survey-results'),
]
