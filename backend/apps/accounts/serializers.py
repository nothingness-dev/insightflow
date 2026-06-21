from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User


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
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'full_name', 'role', 'password', 'password_confirm', 'is_active']

    def validate(self, data):
        if data['password'] != data.pop('password_confirm'):
            raise serializers.ValidationError({'password_confirm': 'رمزهای عبور مطابقت ندارند.'})
        return data

    def create(self, validated_data):
        # Newly created accounts receive a temporary password and must change it
        # on first login.
        user = User.objects.create_user(**validated_data)
        user.must_change_password = True
        user.save(update_fields=['must_change_password'])
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'role', 'is_active']


class PasswordResetSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'رمزهای عبور مطابقت ندارند.'})
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """Self-service password change. The acting user supplies their current
    password plus a new password (twice). Used by both admins and employees."""
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('رمز عبور فعلی نادرست است.')
        return value

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'رمزهای عبور مطابقت ندارند.'})
        if data['current_password'] == data['new_password']:
            raise serializers.ValidationError({'new_password': 'رمز عبور جدید باید با رمز فعلی متفاوت باشد.'})
        return data
