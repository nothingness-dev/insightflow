from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.throttles import AuthRefreshRateThrottle
from . import views


class ThrottledTokenRefreshView(TokenRefreshView):
    """Refresh endpoint with a dedicated tight throttle: it is the
    credential-guessing surface for long-lived refresh tokens."""
    throttle_classes = [AuthRefreshRateThrottle]


urlpatterns = [
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('auth/change-password/', views.ChangePasswordView.as_view(), name='change-password'),

                           
    path('admin/users/', views.UserListCreateView.as_view(), name='user-list-create'),
    path('admin/users/bulk-import/', views.UserBulkImportView.as_view(), name='user-bulk-import'),
    path('admin/users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('admin/users/<int:pk>/reset-password/', views.UserResetPasswordView.as_view(), name='user-reset-password'),
    path('admin/users/<int:pk>/activate/', views.UserActivateView.as_view(), name='user-activate'),
    path('admin/users/<int:pk>/deactivate/', views.UserDeactivateView.as_view(), name='user-deactivate'),
]
