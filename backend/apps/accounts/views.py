from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User
from .serializers import (
    LoginSerializer, UserSerializer, UserCreateSerializer,
    UserUpdateSerializer, PasswordResetSerializer
)
from .permissions import IsAdminUser
import logging

logger = logging.getLogger('apps')


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        refresh = RefreshToken.for_user(user)
        logger.info(f"User logged in: {user.username}")

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass
        return Response({'detail': 'خروج موفق'})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    queryset = User.objects.all().order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(full_name__icontains=search) | qs.filter(username__icontains=search)
        role = self.request.query_params.get('role')
        if role:
            qs = qs.filter(role=role)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        logger.info(f"Admin {request.user.username} created user: {user.username}")
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminUser]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)


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
        user.save()
        logger.info(f"Admin {request.user.username} reset password for: {user.username}")
        return Response({'detail': 'رمز عبور با موفقیت تغییر یافت.'})


class UserActivateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'کاربر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)
        user.is_active = True
        user.save()
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
        user.save()
        logger.info(f"Admin {request.user.username} deactivated user: {user.username}")
        return Response({'detail': 'حساب کاربری غیرفعال شد.'})


class UserBulkImportView(APIView):
    """
    آپلود فایل TXT یا CSV برای ایجاد کاربران به صورت دسته‌ای.

    فرمت CSV/TXT (هر خط یک کاربر):
        username,full_name,password,role
        username,full_name,password          (role پیش‌فرض: employee)

    خطوط خالی و خطوط شروع‌شده با # نادیده گرفته می‌شوند.
    """
    permission_classes = [IsAdminUser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'فایل ارسال نشده است.'}, status=status.HTTP_400_BAD_REQUEST)

        ext = file.name.rsplit('.', 1)[-1].lower()
        if ext not in ('csv', 'txt'):
            return Response({'detail': 'فقط فایل‌های CSV و TXT مجاز هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            content = file.read().decode('utf-8-sig').strip()
        except UnicodeDecodeError:
            try:
                file.seek(0)
                content = file.read().decode('windows-1256').strip()
            except Exception:
                return Response({'detail': 'خطا در خواندن فایل. لطفاً از فرمت UTF-8 استفاده کنید.'}, status=status.HTTP_400_BAD_REQUEST)

        lines = [l.strip() for l in content.splitlines()]
        created = []
        skipped = []
        errors = []

        for i, line in enumerate(lines, start=1):
            # Skip blank lines and comments
            if not line or line.startswith('#'):
                continue

            parts = [p.strip() for p in line.split(',')]
            if len(parts) < 3:
                errors.append({'line': i, 'content': line, 'error': 'حداقل ۳ ستون (نام کاربری، نام، رمز عبور) الزامی است'})
                continue

            username = parts[0]
            full_name = parts[1]
            password = parts[2]
            role = parts[3] if len(parts) >= 4 and parts[3] in ('admin', 'employee') else 'employee'

            if not username or not full_name or not password:
                errors.append({'line': i, 'content': line, 'error': 'نام کاربری، نام و رمز عبور نمی‌توانند خالی باشند'})
                continue

            if len(password) < 8:
                errors.append({'line': i, 'content': line, 'error': 'رمز عبور باید حداقل ۸ کاراکتر باشد'})
                continue

            if User.objects.filter(username=username).exists():
                skipped.append({'line': i, 'username': username, 'reason': 'نام کاربری تکراری است'})
                continue

            try:
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    full_name=full_name,
                    role=role,
                )
                created.append({'username': user.username, 'full_name': user.full_name, 'role': user.role})
            except Exception as e:
                errors.append({'line': i, 'content': line, 'error': str(e)})

        logger.info(
            f"Admin {request.user.username} bulk imported users: "
            f"{len(created)} created, {len(skipped)} skipped, {len(errors)} errors"
        )

        return Response({
            'created_count': len(created),
            'skipped_count': len(skipped),
            'error_count': len(errors),
            'created': created,
            'skipped': skipped,
            'errors': errors,
        }, status=status.HTTP_200_OK)
