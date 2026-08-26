from rest_framework.permissions import BasePermission


def _pending_password_block(user, view):
    """True when the request must be rejected because the user still has a
    forced password change pending. Views that must stay reachable during the
    forced flow declare `password_change_exempt = True`."""
    if getattr(view, 'password_change_exempt', False):
        return False
    return bool(getattr(user, 'must_change_password', False))


class IsAdminUser(BasePermission):
    """فقط کاربران با نقش مدیر دسترسی دارند"""
    message = 'دسترسی فقط برای مدیران مجاز است.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated and user.role == 'admin'):
            return False
        if _pending_password_block(user, view):
            self.message = 'ابتدا باید رمز عبور خود را تغییر دهید.'
            return False
        return True


class IsEmployeeUser(BasePermission):
    """کاربران احراز هویت شده دسترسی دارند"""
    message = 'برای دسترسی باید وارد سیستم شوید.'

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated):
            return False
        if _pending_password_block(user, view):
            self.message = 'ابتدا باید رمز عبور خود را تغییر دهید.'
            return False
        return True
