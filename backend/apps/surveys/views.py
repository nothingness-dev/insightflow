import csv
import io
from django.http import HttpResponse
from django.utils import timezone
from django.db import IntegrityError, transaction
from django.db.models import Count
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from apps.accounts.permissions import IsAdminUser, IsEmployeeUser

from .models import Survey, SurveyQuestion, SurveyPerson, Rating
from .serializers import (
    SurveySerializer, SurveyCreateUpdateSerializer, SurveyPersonSerializer,
    SurveyPersonPublicSerializer, SurveyPublicSerializer, RatingCreateSerializer,
    SurveyProgressDashboardSerializer
)
from .services import calculate_survey_results, duplicate_survey, calculate_survey_progress, validate_question_answers
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
            qs = (qs.filter(title__icontains=search) | qs.filter(question__icontains=search) | qs.filter(questions__text__icontains=search)).distinct()
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


class AdminSurveyProgressView(APIView):
    """Return participation progress for all surveys using bounded aggregate queries."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        progress_data = calculate_survey_progress()
        serializer = SurveyProgressDashboardSerializer(progress_data)
        return Response(serializer.data)


class AdminSurveyDuplicateView(APIView):
    """Duplicate survey settings and people into a new draft without responses."""
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            source_survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        duplicate = duplicate_survey(source_survey, request.user)
        logger.info(
            'Admin %s duplicated survey %s into survey %s',
            request.user.username,
            source_survey.id,
            duplicate.id,
        )
        return Response(
            SurveySerializer(duplicate, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class AdminSurveyPublishView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        if survey.status != Survey.STATUS_DRAFT:
            return Response({'detail': 'فقط نظرسنجی‌های پیش‌نویس قابل انتشار هستند.'}, status=status.HTTP_400_BAD_REQUEST)

        if not survey.title:
            return Response({'detail': 'عنوان نظرسنجی الزامی است.'}, status=status.HTTP_400_BAD_REQUEST)

        if not survey.questions.filter(is_active=True).exists():
            return Response({'detail': 'حداقل یک سوال فعال باید به نظرسنجی اضافه شود.'}, status=status.HTTP_400_BAD_REQUEST)

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
        questions = list(survey.questions.filter(is_active=True).order_by('display_order', 'created_at'))
        headers = ['رتبه', 'نام و نام خانوادگی', 'واحد سازمانی', 'سمت', 'میانگین کلی', 'مجموع امتیاز', 'تعداد رأی‌دهنده']
        for question in questions:
            headers.extend([
                f'میانگین - {question.text}',
                f'تعداد پاسخ امتیازی - {question.text}',
                f'توضیحات - {question.text}',
            ])
        writer.writerow(headers)

        for r in results:
            row = [
                r['rank'], r['full_name'], r['department'], r['role_title'],
                r['average_score'] or '-', r['total_score'], r['votes_count']
            ]
            by_question = {item['question_id']: item for item in r.get('question_results', [])}
            for question in questions:
                q = by_question.get(question.id, {})
                row.extend([
                    q.get('average_score') or '-',
                    q.get('responses_count') or 0,
                    ' | '.join(q.get('comments') or []),
                ])
            writer.writerow(row)

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

        questions = list(survey.questions.filter(is_active=True).order_by('display_order', 'created_at'))
        headers = ['رتبه', 'نام و نام خانوادگی', 'واحد سازمانی', 'سمت', 'میانگین کلی', 'مجموع امتیاز', 'تعداد رأی‌دهنده']
        for question in questions:
            headers.extend([
                f'میانگین - {question.text}',
                f'تعداد پاسخ امتیازی - {question.text}',
                f'توضیحات - {question.text}',
            ])
        ws.append(headers)

        for r in results:
            row = [
                r['rank'], r['full_name'], r['department'], r['role_title'],
                r['average_score'] or 0, r['total_score'], r['votes_count']
            ]
            by_question = {item['question_id']: item for item in r.get('question_results', [])}
            for question in questions:
                q = by_question.get(question.id, {})
                row.extend([
                    q.get('average_score') or 0,
                    q.get('responses_count') or 0,
                    ' | '.join(q.get('comments') or []),
                ])
            ws.append(row)

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
    # This endpoint returns one explicit list payload for the employee app;
    # never let the global admin-table pagination reshape it.
    pagination_class = None

    def get_queryset(self):
        return (
            Survey.objects
            .filter(status__in=[Survey.STATUS_PUBLISHED, Survey.STATUS_CLOSED])
            .order_by('-published_at', '-created_at')
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset().prefetch_related('people', 'questions')
        data = []
        for survey in qs:
            s = SurveySerializer(survey, context={'request': request}).data
            active_people_count = survey.people.filter(is_active=True).count()
            active_questions_count = survey.questions.filter(is_active=True).count()
            required_answers_per_person = active_questions_count

            completed_person_ids = set()
            if required_answers_per_person > 0:
                rows = (
                    Rating.objects
                    .filter(
                        survey=survey,
                        voter=request.user,
                        person__is_active=True,
                        question__is_active=True,
                        question__survey=survey,
                    )
                    .values('person_id')
                    .annotate(answered_count=Count('question_id', distinct=True))
                )
                completed_person_ids = {
                    row['person_id']
                    for row in rows
                    if row['answered_count'] == required_answers_per_person
                }

            s['my_votes_count'] = len(completed_person_ids)
            s['total_people'] = active_people_count
            s['total_questions'] = active_questions_count
            data.append(s)
        return Response(data)


class EmployeeSurveyDetailView(APIView):
    permission_classes = [IsEmployeeUser]

    def get(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk, status__in=[Survey.STATUS_PUBLISHED, Survey.STATUS_CLOSED])
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SurveyPublicSerializer(survey, context={'request': request})
        data = serializer.data

        active_questions_count = survey.questions.filter(is_active=True).count()
        completed_person_ids = set()
        if active_questions_count > 0:
            rows = (
                Rating.objects
                .filter(
                    survey=survey,
                    voter=request.user,
                    person__is_active=True,
                    question__is_active=True,
                    question__survey=survey,
                )
                .values('person_id')
                .annotate(answered_count=Count('question_id', distinct=True))
            )
            completed_person_ids = {
                row['person_id']
                for row in rows
                if row['answered_count'] == active_questions_count
            }

        for person in data['people']:
            person['has_rated'] = person['id'] in completed_person_ids

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

        try:
            person = SurveyPerson.objects.get(pk=person_id, survey=survey, is_active=True)
        except SurveyPerson.DoesNotExist:
            return Response({'detail': 'فرد مورد نظر یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        if Rating.objects.filter(survey=survey, person=person, voter=request.user).exists():
            return Response({'detail': 'شما قبلاً برای این فرد پاسخ ثبت کرده‌اید.'}, status=status.HTTP_400_BAD_REQUEST)

        questions = list(survey.questions.filter(is_active=True).order_by('display_order', 'created_at'))
        if not questions and survey.question:
            questions = [SurveyQuestion.objects.create(
                survey=survey,
                text=survey.question,
                has_score=True,
                score_required=True,
                has_comment=True,
                comment_required=False,
                display_order=0,
                is_active=True,
            )]
        if not questions:
            return Response({'detail': 'این نظرسنجی هنوز سوال فعالی ندارد.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = RatingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submitted_answers = serializer.validated_data.get('answers')
        if submitted_answers is None:
            # Backward-compatible single-score payload. It is valid only for
            # surveys with one active question.
            if len(questions) != 1:
                return Response({'detail': 'برای این نظرسنجی باید پاسخ همه سوال‌ها ارسال شود.'}, status=status.HTTP_400_BAD_REQUEST)
            submitted_answers = [{
                'question_id': questions[0].id,
                'score': serializer.validated_data.get('score'),
                'comment': serializer.validated_data.get('comment'),
            }]

        try:
            validated_answers = validate_question_answers(questions, submitted_answers)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                Rating.objects.bulk_create([
                    Rating(
                        survey=survey,
                        person=person,
                        question=item['question'],
                        voter=request.user,
                        score=item['score'],
                        comment=item['comment'],
                        ip_address=get_client_ip(request),
                        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
                    )
                    for item in validated_answers
                ])
        except IntegrityError:
            return Response({'detail': 'شما قبلاً برای این فرد پاسخ ثبت کرده‌اید.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'detail': 'پاسخ‌های شما با موفقیت ثبت شد.'}, status=status.HTTP_201_CREATED)


class EmployeeMyRatingsView(APIView):
    permission_classes = [IsEmployeeUser]

    def get(self, request, survey_id):
        try:
            survey = Survey.objects.get(pk=survey_id)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        total_active_people = survey.people.filter(is_active=True).count()
        active_questions_count = survey.questions.filter(is_active=True).count()
        completed_person_ids = []

        if active_questions_count > 0:
            rows = (
                Rating.objects
                .filter(
                    survey=survey,
                    voter=request.user,
                    person__is_active=True,
                    question__is_active=True,
                    question__survey=survey,
                )
                .values('person_id')
                .annotate(answered_count=Count('question_id', distinct=True))
            )
            completed_person_ids = [
                row['person_id']
                for row in rows
                if row['answered_count'] == active_questions_count
            ]

        return Response({
            'survey_id': survey.id,
            'rated_person_ids': completed_person_ids,
            'rated_count': len(completed_person_ids),
            'total_people': total_active_people,
            'total_questions': active_questions_count,
            'required_answers_count': total_active_people * active_questions_count,
            'is_complete': len(completed_person_ids) == total_active_people and total_active_people > 0 and active_questions_count > 0,
        })


class EmployeeSurveyResultsView(APIView):
    permission_classes = [IsEmployeeUser]

    def get(self, request, survey_id):
        try:
            survey = Survey.objects.get(pk=survey_id)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        can_view = False
        # Results are only visible if explicitly set to allow employees (currently admin_only is the only option)
        # So employees never see results — always forbidden
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
        # Count voters who fully completed at least one survey
        from django.db.models import Count as DCount, F as DF, Q as DQ
        total_responses = 0
        for survey in Survey.objects.prefetch_related('people', 'questions'):
            active_people = survey.people.filter(is_active=True).count()
            active_questions = survey.questions.filter(is_active=True).count()
            required = active_people * active_questions
            if not required:
                continue
            total_responses += (
                Rating.objects
                .filter(survey=survey, person__is_active=True, question__is_active=True)
                .values('voter_id')
                .annotate(answered_count=DCount('id', distinct=True))
                .filter(answered_count=required)
                .count()
            )
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


class AdminDeleteAllDataView(APIView):
    """حذف تمام داده‌ها — فقط مدیر، غیرقابل بازگشت"""
    permission_classes = [IsAdminUser]

    def delete(self, request):
        from apps.accounts.models import User

        # Verify confirmation token sent in body
        confirm = request.data.get('confirm')
        if confirm != 'DELETE_ALL':
            return Response(
                {'detail': 'برای تأیید، مقدار "DELETE_ALL" را ارسال کنید.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Delete all ratings, survey people, surveys, and employee users
        ratings_count = Rating.objects.count()
        people_count = SurveyPerson.objects.count()
        surveys_count = Survey.objects.count()
        employees_count = User.objects.filter(role='employee').count()

        Rating.objects.all().delete()
        SurveyPerson.objects.all().delete()
        Survey.objects.all().delete()
        User.objects.filter(role='employee').delete()

        logger.warning(
            f"Admin {request.user.username} deleted ALL data: "
            f"{surveys_count} surveys, {people_count} survey-people, "
            f"{ratings_count} ratings, {employees_count} employees"
        )

        return Response({
            'detail': 'تمام داده‌ها با موفقیت حذف شدند.',
            'deleted': {
                'surveys': surveys_count,
                'people': people_count,
                'ratings': ratings_count,
                'employees': employees_count,
            }
        })
