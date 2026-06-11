import csv
import io
from django.http import HttpResponse
from django.utils import timezone
from django.db import IntegrityError
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from apps.accounts.permissions import IsAdminUser, IsEmployeeUser

from .models import Survey, SurveyPerson, Rating
from .serializers import (
    SurveySerializer, SurveyCreateUpdateSerializer, SurveyPersonSerializer,
    SurveyPersonPublicSerializer, SurveyPublicSerializer, RatingCreateSerializer
)
from .services import calculate_survey_results
import logging

logger = logging.getLogger('apps')

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False


def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ============================================================
# Admin Survey Views
# ============================================================

class AdminSurveyListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    queryset = Survey.objects.all()

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SurveyCreateUpdateSerializer
        return SurveySerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(title__icontains=search) | qs.filter(question__icontains=search)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = SurveyCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        survey = serializer.save(created_by=request.user)
        logger.info(f"Admin {request.user.username} created survey: {survey.title}")
        return Response(SurveySerializer(survey, context={'request': request}).data, status=status.HTTP_201_CREATED)


class AdminSurveyDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    queryset = Survey.objects.all()

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return SurveyCreateUpdateSerializer
        return SurveySerializer

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        instance = self.get_object()
        if instance.status == Survey.STATUS_CLOSED:
            return Response({'detail': 'نظرسنجی بسته شده قابل ویرایش نیست.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        logger.info(f"Admin {request.user.username} deleted survey: {instance.title}")
        return super().destroy(request, *args, **kwargs)


class AdminSurveyPublishView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        if survey.status != Survey.STATUS_DRAFT:
            return Response({'detail': 'فقط نظرسنجی‌های پیش‌نویس قابل انتشار هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        if not survey.title or not survey.question:
            return Response({'detail': 'عنوان و سوال اصلی الزامی هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        if not survey.people.filter(is_active=True).exists():
            return Response({'detail': 'حداقل یک فرد فعال باید به نظرسنجی اضافه شود.'}, status=status.HTTP_400_BAD_REQUEST)

        survey.status = Survey.STATUS_PUBLISHED
        survey.published_at = timezone.now()
        survey.save()
        logger.info(f"Admin {request.user.username} published survey: {survey.title}")
        return Response(SurveySerializer(survey, context={'request': request}).data)


class AdminSurveyCloseView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        if survey.status != Survey.STATUS_PUBLISHED:
            return Response({'detail': 'فقط نظرسنجی‌های منتشرشده قابل بستن هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        survey.status = Survey.STATUS_CLOSED
        survey.closed_at = timezone.now()
        survey.save()
        logger.info(f"Admin {request.user.username} closed survey: {survey.title}")
        return Response(SurveySerializer(survey, context={'request': request}).data)


class AdminSurveyResultsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        results = calculate_survey_results(survey, request)
        return Response({
            'survey': SurveySerializer(survey, context={'request': request}).data,
            'results': results
        })


class AdminSurveyExportCSVView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        results = calculate_survey_results(survey, request)

        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="results_{pk}.csv"'
        response.write('\ufeff')  # BOM for Excel Persian support

        writer = csv.writer(response)
        writer.writerow(['رتبه', 'نام و نام خانوادگی', 'واحد سازمانی', 'سمت', 'میانگین امتیاز', 'مجموع امتیاز', 'تعداد رأی'])

        for r in results:
            writer.writerow([
                r['rank'], r['full_name'], r['department'], r['role_title'],
                r['average_score'] or '-', r['total_score'], r['votes_count']
            ])

        return response


class AdminSurveyExportExcelView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        if not HAS_OPENPYXL:
            return Response({'detail': 'خروجی اکسل در دسترس نیست.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        results = calculate_survey_results(survey, request)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'نتایج نظرسنجی'
        ws.sheet_view.rightToLeft = True

        headers = ['رتبه', 'نام و نام خانوادگی', 'واحد سازمانی', 'سمت', 'میانگین امتیاز', 'مجموع امتیاز', 'تعداد رأی']
        ws.append(headers)

        for r in results:
            ws.append([
                r['rank'], r['full_name'], r['department'], r['role_title'],
                r['average_score'] or 0, r['total_score'], r['votes_count']
            ])

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="results_{pk}.xlsx"'
        return response


# ============================================================
# Admin Person Views
# ============================================================

class AdminPersonListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = SurveyPersonSerializer

    def get_queryset(self):
        survey_id = self.kwargs['survey_id']
        return SurveyPerson.objects.filter(survey_id=survey_id)

    def perform_create(self, serializer):
        survey_id = self.kwargs['survey_id']
        try:
            survey = Survey.objects.get(pk=survey_id)
        except Survey.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('نظرسنجی یافت نشد.')
        serializer.save(survey=survey)


class AdminPersonDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdminUser]
    serializer_class = SurveyPersonSerializer
    queryset = SurveyPerson.objects.all()

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return super().update(request, *args, **kwargs)


# ============================================================
# Employee Survey Views
# ============================================================

class EmployeeSurveyListView(generics.ListAPIView):
    permission_classes = [IsEmployeeUser]
    serializer_class = SurveySerializer

    def get_queryset(self):
        return Survey.objects.filter(status=Survey.STATUS_PUBLISHED)

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        data = []
        for survey in qs:
            s = SurveySerializer(survey, context={'request': request}).data
            s['my_votes_count'] = Rating.objects.filter(survey=survey, voter=request.user).count()
            s['total_people'] = survey.people.filter(is_active=True).count()
            data.append(s)
        return Response(data)


class EmployeeSurveyDetailView(APIView):
    permission_classes = [IsEmployeeUser]

    def get(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk, status=Survey.STATUS_PUBLISHED)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SurveyPublicSerializer(survey, context={'request': request})
        data = serializer.data

        # Add my rating status per person (only boolean, no score exposed)
        my_ratings = set(
            Rating.objects.filter(survey=survey, voter=request.user).values_list('person_id', flat=True)
        )
        for person in data['people']:
            person['has_rated'] = person['id'] in my_ratings

        return Response(data)


class EmployeeRatePersonView(APIView):
    permission_classes = [IsEmployeeUser]

    def post(self, request, survey_id, person_id):
        try:
            survey = Survey.objects.get(pk=survey_id)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        if survey.status == Survey.STATUS_DRAFT:
            return Response({'detail': 'این نظرسنجی هنوز منتشر نشده است.'}, status=status.HTTP_400_BAD_REQUEST)

        if survey.status == Survey.STATUS_CLOSED:
            return Response({'detail': 'این نظرسنجی بسته شده است.'}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()
        if survey.starts_at and now < survey.starts_at:
            return Response({'detail': 'این نظرسنجی هنوز شروع نشده است.'}, status=status.HTTP_400_BAD_REQUEST)

        if survey.ends_at and now > survey.ends_at:
            return Response({'detail': 'مهلت این نظرسنجی به پایان رسیده است.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            person = SurveyPerson.objects.get(pk=person_id, survey=survey, is_active=True)
        except SurveyPerson.DoesNotExist:
            return Response({'detail': 'فرد مورد نظر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        if Rating.objects.filter(survey=survey, person=person, voter=request.user).exists():
            return Response({'detail': 'شما قبلاً برای این فرد امتیاز ثبت کرده‌اید.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RatingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            Rating.objects.create(
                survey=survey,
                person=person,
                voter=request.user,
                score=serializer.validated_data['score'],
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            )
        except IntegrityError:
            return Response({'detail': 'شما قبلاً برای این فرد امتیاز ثبت کرده‌اید.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'detail': 'امتیاز شما با موفقیت ثبت شد.'}, status=status.HTTP_201_CREATED)


class EmployeeMyRatingsView(APIView):
    permission_classes = [IsEmployeeUser]

    def get(self, request, survey_id):
        try:
            survey = Survey.objects.get(pk=survey_id)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        rated_person_ids = list(
            Rating.objects.filter(survey=survey, voter=request.user).values_list('person_id', flat=True)
        )
        total_active_people = survey.people.filter(is_active=True).count()

        return Response({
            'survey_id': survey.id,
            'rated_person_ids': rated_person_ids,
            'rated_count': len(rated_person_ids),
            'total_people': total_active_people,
            'is_complete': len(rated_person_ids) == total_active_people and total_active_people > 0,
        })


class EmployeeSurveyResultsView(APIView):
    permission_classes = [IsEmployeeUser]

    def get(self, request, survey_id):
        try:
            survey = Survey.objects.get(pk=survey_id)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        can_view = False
        if survey.status == Survey.STATUS_CLOSED:
            if survey.results_visibility in [
                Survey.VISIBILITY_EMPLOYEES_AFTER_CLOSE,
                Survey.VISIBILITY_PUBLIC_AFTER_CLOSE
            ]:
                can_view = True

        if not can_view:
            return Response({'detail': 'نتایج این نظرسنجی در دسترس نیست.'}, status=status.HTTP_403_FORBIDDEN)

        results = calculate_survey_results(survey, request)
        return Response({
            'survey': {
                'id': survey.id,
                'title': survey.title,
                'question': survey.question,
                'status': survey.status,
            },
            'results': results
        })


# ============================================================
# Admin Dashboard Stats
# ============================================================

class AdminDashboardView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        from apps.accounts.models import User

        total_surveys = Survey.objects.count()
        draft_surveys = Survey.objects.filter(status=Survey.STATUS_DRAFT).count()
        published_surveys = Survey.objects.filter(status=Survey.STATUS_PUBLISHED).count()
        closed_surveys = Survey.objects.filter(status=Survey.STATUS_CLOSED).count()
        total_responses = Rating.objects.count()
        total_employees = User.objects.filter(role='employee').count()

        recent_surveys = Survey.objects.order_by('-created_at')[:5]
        recent_data = SurveySerializer(recent_surveys, many=True, context={'request': request}).data

        return Response({
            'stats': {
                'total_surveys': total_surveys,
                'draft_surveys': draft_surveys,
                'published_surveys': published_surveys,
                'closed_surveys': closed_surveys,
                'total_responses': total_responses,
                'total_employees': total_employees,
            },
            'recent_surveys': recent_data,
        })
