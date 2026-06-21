import csv
import io
import logging
import os
from concurrent.futures import ThreadPoolExecutor

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.activity.models import ActivityActions, ActivityLog
from apps.activity.services import log_activity

from .models import User
from .permissions import IsAdminUser
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

logger = logging.getLogger('apps')


class UserPagination(PageNumberPagination):
    """Pagination dedicated to the employee-management table."""

    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:
            attempted_username = (request.data.get('username') or '')[:150]
            log_activity(
                ActivityActions.LOGIN_FAILED,
                request=request,
                description=(
                    f'تلاش ناموفق برای ورود با نام کاربری «{attempted_username}»'
                    if attempted_username else 'تلاش ناموفق برای ورود'
                ),
                status=ActivityLog.STATUS_FAILED,
                target_type='user',
                target_repr=attempted_username,
                metadata={'attempted_username': attempted_username},
            )
            raise
        user = serializer.validated_data['user']

        refresh = RefreshToken.for_user(user)
        logger.info('User logged in: %s', user.username)
        log_activity(
            ActivityActions.LOGIN,
            request=request,
            actor=user,
            description=f'ورود موفق به سیستم: {user.username}',
            target_type='user',
            target_id=user.id,
            target_repr=user.full_name or user.username,
        )

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                RefreshToken(refresh_token).blacklist()
        except Exception:
            pass
        log_activity(
            ActivityActions.LOGOUT,
            request=request,
            description='خروج از سیستم',
            target_type='user',
            target_id=getattr(request.user, 'id', ''),
            target_repr=getattr(request.user, 'username', ''),
        )
        return Response({'detail': 'خروج موفق'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    """Authenticated users (admin or employee) change their own password."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.must_change_password = False
        user.save(update_fields=['password', 'must_change_password', 'updated_at'])
        logger.info('User changed own password: %s', user.username)
        log_activity(
            ActivityActions.PASSWORD_CHANGE,
            request=request,
            actor=user,
            description=f'تغییر رمز عبور توسط {user.username}',
            target_type='user',
            target_id=user.id,
            target_repr=user.full_name or user.username,
        )
        return Response({'detail': 'رمز عبور با موفقیت تغییر یافت.'})


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    pagination_class = UserPagination
    queryset = User.objects.all().order_by('-created_at')

    def get_serializer_class(self):
        return UserCreateSerializer if self.request.method == 'POST' else UserSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        role = self.request.query_params.get('role', '').strip()

        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) | Q(username__icontains=search)
            )
        if role in dict(User.ROLE_CHOICES):
            queryset = queryset.filter(role=role)

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        logger.info('Admin %s created user: %s', request.user.username, user.username)
        log_activity(
            ActivityActions.USER_CREATE,
            request=request,
            description=f'ایجاد کاربر «{user.full_name or user.username}» با نقش {user.get_role_display()}',
            target_type='user',
            target_id=user.id,
            target_repr=user.full_name or user.username,
            metadata={'username': user.username, 'role': user.role},
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminUser]
    queryset = User.objects.all()

    def get_serializer_class(self):
        return UserUpdateSerializer if self.request.method in ['PUT', 'PATCH'] else UserSerializer

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        # FIX #4: snapshot BEFORE super().update() so the log reflects pre-update data
        # and we avoid a second DB round-trip (get_object() after save() was wasteful).
        user = self.get_object()
        response = super().update(request, *args, **kwargs)
        # Refresh to pick up any field changes applied by the serializer.
        user.refresh_from_db()
        log_activity(
            ActivityActions.USER_EDIT,
            request=request,
            description=f'ویرایش کاربر «{user.full_name or user.username}»',
            target_type='user',
            target_id=user.id,
            target_repr=user.full_name or user.username,
            metadata={'username': user.username, 'role': user.role, 'is_active': user.is_active},
        )
        return response

    def delete(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'کاربر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({'detail': 'نمی‌توانید حساب خود را حذف کنید.'}, status=status.HTTP_400_BAD_REQUEST)

        username = user.username
        full_name = user.full_name
        user_id = user.id
        user.delete()
        logger.info('Admin %s deleted user: %s', request.user.username, username)
        log_activity(
            ActivityActions.USER_DELETE,
            request=request,
            description=f'حذف کاربر «{full_name or username}»',
            target_type='user',
            target_id=user_id,
            target_repr=full_name or username,
            metadata={'username': username},
        )
        return Response({'detail': 'کاربر با موفقیت حذف شد.'}, status=status.HTTP_200_OK)


class UserResetPasswordView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'کاربر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.must_change_password = True
        user.save(update_fields=['password', 'must_change_password', 'updated_at'])
        logger.info('Admin %s reset password for: %s', request.user.username, user.username)
        log_activity(
            ActivityActions.PASSWORD_RESET,
            request=request,
            description=f'بازنشانی رمز عبور کاربر «{user.full_name or user.username}»',
            target_type='user',
            target_id=user.id,
            target_repr=user.full_name or user.username,
            metadata={'username': user.username},
        )
        return Response({'detail': 'رمز عبور با موفقیت تغییر یافت.'})


class UserActivateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'کاربر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)
        user.is_active = True
        user.save(update_fields=['is_active', 'updated_at'])
        log_activity(
            ActivityActions.USER_ACTIVATE,
            request=request,
            description=f'فعال‌سازی حساب کاربر «{user.full_name or user.username}»',
            target_type='user',
            target_id=user.id,
            target_repr=user.full_name or user.username,
            metadata={'username': user.username},
        )
        return Response({'detail': 'حساب کاربری فعال شد.'})


class UserDeactivateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'کاربر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        if user == request.user:
            return Response({'detail': 'نمی‌توانید حساب خود را غیرفعال کنید.'}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = False
        user.save(update_fields=['is_active', 'updated_at'])
        logger.info('Admin %s deactivated user: %s', request.user.username, user.username)
        log_activity(
            ActivityActions.USER_DEACTIVATE,
            request=request,
            description=f'غیرفعال‌سازی حساب کاربر «{user.full_name or user.username}»',
            target_type='user',
            target_id=user.id,
            target_repr=user.full_name or user.username,
            metadata={'username': user.username},
        )
        return Response({'detail': 'حساب کاربری غیرفعال شد.'})


class UserBulkImportView(APIView):
    """Create users from a CSV/TXT file without per-row database lookups."""

    permission_classes = [IsAdminUser]

    MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
    MAX_ROWS = 5_000
    DETAIL_LIMIT = 100
    BULK_CREATE_BATCH_SIZE = 100

    @staticmethod
    def _decode_upload(file):
        raw_content = file.read()
        for encoding in ('utf-8-sig', 'windows-1256'):
            try:
                return raw_content.decode(encoding)
            except UnicodeDecodeError:
                continue
        raise UnicodeDecodeError('bulk-import', raw_content, 0, 1, 'unsupported file encoding')

    @staticmethod
    def _limited_details(items, limit):
        return items[:limit], max(0, len(items) - limit)

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'فایل ارسال نشده است.'}, status=status.HTTP_400_BAD_REQUEST)

        extension = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
        if extension not in ('csv', 'txt'):
            return Response({'detail': 'فقط فایل‌های CSV و TXT مجاز هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        if file.size > self.MAX_FILE_SIZE_BYTES:
            return Response(
                {'detail': 'حجم فایل کاربران نباید از ۵ مگابایت بیشتر باشد.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            content = self._decode_upload(file)
        except UnicodeDecodeError:
            return Response(
                {'detail': 'خطا در خواندن فایل. لطفاً از فرمت UTF-8 استفاده کنید.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed_rows = []
        skipped = []
        errors = []
        seen_usernames = set()
        username_max_length = User._meta.get_field('username').max_length
        full_name_max_length = User._meta.get_field('full_name').max_length

        reader = csv.reader(io.StringIO(content))
        for line_number, row in enumerate(reader, start=1):
            if not row or not any(cell.strip() for cell in row):
                continue

            cells = [cell.strip() for cell in row]
            if cells[0].startswith('#'):
                continue

            # Accept a conventional header row even when comment lines appear before it.
            if cells[0].lower() in {'username', 'نام کاربری'} and len(cells) >= 3:
                continue

            if len(parsed_rows) + len(skipped) + len(errors) >= self.MAX_ROWS:
                return Response(
                    {'detail': f'حداکثر {self.MAX_ROWS} ردیف در هر فایل قابل پردازش است.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if len(cells) < 3:
                errors.append({
                    'line': line_number,
                    'error': 'حداقل ۳ ستون (نام کاربری، نام، رمز عبور) الزامی است.',
                })
                continue

            username, full_name, password = cells[:3]
            role = cells[3] if len(cells) >= 4 and cells[3] in dict(User.ROLE_CHOICES) else 'employee'

            if not username or not full_name or not password:
                errors.append({
                    'line': line_number,
                    'error': 'نام کاربری، نام و رمز عبور نمی‌توانند خالی باشند.',
                })
                continue
            if len(username) > username_max_length:
                errors.append({'line': line_number, 'error': 'نام کاربری بیش از حد طولانی است.'})
                continue
            if len(full_name) > full_name_max_length:
                errors.append({'line': line_number, 'error': 'نام کامل بیش از حد طولانی است.'})
                continue
            if len(password) < 8:
                errors.append({'line': line_number, 'error': 'رمز عبور باید حداقل ۸ کاراکتر باشد.'})
                continue
            if username in seen_usernames:
                skipped.append({
                    'line': line_number,
                    'username': username,
                    'reason': 'نام کاربری در همین فایل تکراری است.',
                })
                continue

            seen_usernames.add(username)
            parsed_rows.append({
                'line': line_number,
                'username': username,
                'full_name': full_name,
                'password': password,
                'role': role,
            })

        existing_usernames = set(
            User.objects.filter(username__in=seen_usernames).values_list('username', flat=True)
        )
        rows_to_create = []
        for row in parsed_rows:
            if row['username'] in existing_usernames:
                skipped.append({
                    'line': row['line'],
                    'username': row['username'],
                    'reason': 'نام کاربری تکراری است.',
                })
            else:
                rows_to_create.append(row)

        # Password hashing is intentionally retained for security. Running a
        # small, bounded pool keeps large imports responsive without weakening
        # the configured Django password hasher.
        worker_count = min(4, max(1, os.cpu_count() or 1))
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            password_hashes = list(executor.map(lambda row: make_password(row['password']), rows_to_create))

        users_to_create = [
            User(
                username=row['username'],
                full_name=row['full_name'],
                role=row['role'],
                password=password_hash,
                is_active=True,
                must_change_password=True,
            )
            for row, password_hash in zip(rows_to_create, password_hashes)
        ]

        if users_to_create:
            with transaction.atomic():
                User.objects.bulk_create(users_to_create, batch_size=self.BULK_CREATE_BATCH_SIZE)

        created = [
            {'username': row['username'], 'full_name': row['full_name'], 'role': row['role']}
            for row in rows_to_create
        ]
        created_details, created_omitted = self._limited_details(created, self.DETAIL_LIMIT)
        skipped_details, skipped_omitted = self._limited_details(skipped, self.DETAIL_LIMIT)
        error_details, error_omitted = self._limited_details(errors, self.DETAIL_LIMIT)

        logger.info(
            'Admin %s bulk imported users: %s created, %s skipped, %s errors',
            request.user.username,
            len(created),
            len(skipped),
            len(errors),
        )
        log_activity(
            ActivityActions.BULK_IMPORT,
            request=request,
            description=(
                f'ورود گروهی کارکنان: {len(created)} ایجاد، '
                f'{len(skipped)} رد شده، {len(errors)} خطا'
            ),
            target_type='user_import',
            target_repr=file.name,
            metadata={
                'created_count': len(created),
                'skipped_count': len(skipped),
                'error_count': len(errors),
                'file_name': file.name,
            },
        )

        return Response({
            'created_count': len(created),
            'skipped_count': len(skipped),
            'error_count': len(errors),
            'created': created_details,
            'skipped': skipped_details,
            'errors': error_details,
            'details_truncated': any((created_omitted, skipped_omitted, error_omitted)),
            'created_details_omitted': created_omitted,
            'skipped_details_omitted': skipped_omitted,
            'error_details_omitted': error_omitted,
        }, status=status.HTTP_200_OK)
