from django.contrib.auth.password_validation import (
    CommonPasswordValidator,
    MinimumLengthValidator,
    NumericPasswordValidator,
    UserAttributeSimilarityValidator,
)
from django.core.exceptions import ValidationError


class PersianUserAttributeSimilarityValidator(UserAttributeSimilarityValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user=user)
        except ValidationError as exc:
            raise ValidationError(
                'رمز عبور به اطلاعات حساب خیلی شبیه است.',
                code='password_too_similar',
            ) from exc


class PersianMinimumLengthValidator(MinimumLengthValidator):
    def validate(self, password, user=None):
        if len(password) < self.min_length:
            length = str(self.min_length).translate(str.maketrans('0123456789', '۰۱۲۳۴۵۶۷۸۹'))
            raise ValidationError(
                f'رمز عبور باید حداقل {length} کاراکتر باشد.',
                code='password_too_short',
            )


class PersianCommonPasswordValidator(CommonPasswordValidator):
    def validate(self, password, user=None):
        try:
            super().validate(password, user=user)
        except ValidationError as exc:
            raise ValidationError(
                'این رمز عبور خیلی ساده است.',
                code='password_too_common',
            ) from exc


class PersianNumericPasswordValidator(NumericPasswordValidator):
    def validate(self, password, user=None):
        if password.isdigit():
            raise ValidationError(
                'رمز عبور نباید فقط عدد باشد.',
                code='password_entirely_numeric',
            )
