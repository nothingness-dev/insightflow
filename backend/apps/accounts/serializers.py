from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User


def _validate_password(value, user=None):
    """Run Django's configured policy and expose its messages through DRF."""
    try:
        validate_password(value, user=user)
    except DjangoValidationError as exc:
        # A popup should give one clear next step, not a wall of validator text.
        raise serializers.ValidationError(exc.messages[0]) from exc
    return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data['username'], password=data['password'])
        if not user:
            raise serializers.ValidationError('نام کاربری یا رمز عبور اشتباه است.')
        if not user.is_active:
            raise serializers.ValidationError('حساب کاربری شما غیرفعال شده است.')
        data['user'] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'role', 'is_active', 'must_change_password', 'created_at']
        read_only_fields = ['id', 'created_at', 'must_change_password']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'full_name', 'role', 'password', 'password_confirm', 'is_active']

    def validate(self, data):
        if data['password'] != data.pop('password_confirm'):
            raise serializers.ValidationError({'password_confirm': 'رمزهای عبور مطابقت ندارند.'})
        candidate = User(
            username=data.get('username', ''),
            full_name=data.get('full_name', ''),
            role=data.get('role', 'employee'),
        )
        _validate_password(data['password'], user=candidate)
        return data

    def create(self, validated_data):

        user = User.objects.create_user(**validated_data)
        user.must_change_password = True
        user.save(update_fields=['must_change_password'])
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'role', 'is_active']


class PasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'رمزهای عبور مطابقت ندارند.'})
        _validate_password(data['new_password'], user=self.context.get('user'))
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """Self-service password change. The acting user supplies their current
    password plus a new password (twice). Used by both admins and employees."""
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('رمز عبور فعلی نادرست است.')
        return value

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'رمزهای عبور مطابقت ندارند.'})
        _validate_password(data['new_password'], user=self.context['request'].user)
        return data
