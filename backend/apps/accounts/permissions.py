from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """فقط کاربران با نقش مدیر دسترسی دارند"""
    message = 'دسترسی فقط برای مدیران مجاز است.'

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsEmployeeUser(BasePermission):
    """کاربران احراز هویت شده دسترسی دارند"""
    message = 'برای دسترسی باید وارد سیستم شوید.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
