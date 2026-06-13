from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.MeView.as_view(), name='me'),

    # Admin user management
    path('admin/users/', views.UserListCreateView.as_view(), name='user-list-create'),
    path('admin/users/bulk-import/', views.UserBulkImportView.as_view(), name='user-bulk-import'),
    path('admin/users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('admin/users/<int:pk>/reset-password/', views.UserResetPasswordView.as_view(), name='user-reset-password'),
    path('admin/users/<int:pk>/activate/', views.UserActivateView.as_view(), name='user-activate'),
    path('admin/users/<int:pk>/deactivate/', views.UserDeactivateView.as_view(), name='user-deactivate'),
]
