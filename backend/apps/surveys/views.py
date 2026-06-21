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
from apps.activity.models import ActivityActions
from apps.activity.services import log_activity
from .export_data import (
    build_export_dataset, build_pdf_comment_groups, score_grade, EXCEL_CELL_LIMIT,
)
import logging
from django.conf import settings
from django.core.cache import cache
from apps.core.cache import (
    key_dashboard, key_survey_results, key_employee_survey_list,
    invalidate_dashboard, invalidate_survey_results,
    invalidate_all_employee_survey_lists, invalidate_employee_survey_list,
)

logger = logging.getLogger('apps')

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

try:
    from .pdf_report import build_survey_pdf
    HAS_PDF = True
    PDF_IMPORT_ERROR = None
except Exception as _pdf_import_exc:  # noqa: BLE001 - any import failure must degrade gracefully
    HAS_PDF = False
    PDF_IMPORT_ERROR = str(_pdf_import_exc)


# FIX #13: removed duplicate get_client_ip() — consolidated into activity.services._client_ip.
# Import the shared helper to keep IP extraction logic in one place with consistent priority order.
from apps.activity.services import _client_ip as get_client_ip


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
        log_activity(
            ActivityActions.SURVEY_CREATE,
            request=request,
            description=f'ایجاد نظرسنجی «{survey.title}»',
            target_type='survey',
            target_id=survey.id,
            target_repr=survey.title,
        )
        active_questions = survey.questions.filter(is_active=True).count()
        if active_questions:
            log_activity(
                ActivityActions.QUESTION_ADD,
                request=request,
                description=f'افزودن {active_questions} سوال به نظرسنجی «{survey.title}»',
                target_type='survey',
                target_id=survey.id,
                target_repr=survey.title,
                metadata={'questions_added': active_questions},
            )
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

        # Snapshot question state so we can record granular add/edit/delete events.
        before_texts = {q.id: q.text for q in instance.questions.all()}
        before_active = set(instance.questions.filter(is_active=True).values_list('id', flat=True))

        response = super().update(request, *args, **kwargs)

        instance.refresh_from_db()
        after_texts = {q.id: q.text for q in instance.questions.all()}
        after_active = set(instance.questions.filter(is_active=True).values_list('id', flat=True))
        added = len([qid for qid in after_texts if qid not in before_texts])
        deactivated = len(before_active - after_active)
        edited = len([
            qid for qid in (before_active & after_active)
            if before_texts.get(qid) != after_texts.get(qid)
        ])

        log_activity(
            ActivityActions.SURVEY_EDIT,
            request=request,
            description=f'ویرایش نظرسنجی «{instance.title}»',
            target_type='survey',
            target_id=instance.id,
            target_repr=instance.title,
        )
        if added:
            log_activity(
                ActivityActions.QUESTION_ADD,
                request=request,
                description=f'افزودن {added} سوال به نظرسنجی «{instance.title}»',
                target_type='survey', target_id=instance.id, target_repr=instance.title,
                metadata={'questions_added': added},
            )
        if edited:
            log_activity(
                ActivityActions.QUESTION_EDIT,
                request=request,
                description=f'ویرایش {edited} سوال در نظرسنجی «{instance.title}»',
                target_type='survey', target_id=instance.id, target_repr=instance.title,
                metadata={'questions_edited': edited},
            )
        if deactivated:
            log_activity(
                ActivityActions.QUESTION_DELETE,
                request=request,
                description=f'حذف {deactivated} سوال از نظرسنجی «{instance.title}»',
                target_type='survey', target_id=instance.id, target_repr=instance.title,
                metadata={'questions_deleted': deactivated},
            )
        invalidate_dashboard()
        invalidate_survey_results(instance.id)
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        logger.info(f"Admin {request.user.username} deleted survey: {instance.title}")
        survey_id, survey_title = instance.id, instance.title
        response = super().destroy(request, *args, **kwargs)
        invalidate_dashboard()
        invalidate_survey_results(survey_id)
        invalidate_all_employee_survey_lists()
        log_activity(
            ActivityActions.SURVEY_DELETE,
            request=request,
            description=f'حذف نظرسنجی «{survey_title}»',
            target_type='survey',
            target_id=survey_id,
            target_repr=survey_title,
        )
        return response


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
        log_activity(
            ActivityActions.SURVEY_DUPLICATE,
            request=request,
            description=f'تکثیر نظرسنجی «{source_survey.title}» به «{duplicate.title}»',
            target_type='survey',
            target_id=duplicate.id,
            target_repr=duplicate.title,
            metadata={'source_survey_id': source_survey.id},
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
        invalidate_dashboard()
        invalidate_all_employee_survey_lists()
        logger.info(f"Admin {request.user.username} published survey: {survey.title}")
        log_activity(
            ActivityActions.SURVEY_PUBLISH,
            request=request,
            description=f'انتشار نظرسنجی «{survey.title}»',
            target_type='survey',
            target_id=survey.id,
            target_repr=survey.title,
        )
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
        invalidate_dashboard()
        invalidate_survey_results(survey.id)
        invalidate_all_employee_survey_lists()
        logger.info(f"Admin {request.user.username} closed survey: {survey.title}")
        log_activity(
            ActivityActions.SURVEY_CLOSE,
            request=request,
            description=f'بستن نظرسنجی «{survey.title}»',
            target_type='survey',
            target_id=survey.id,
            target_repr=survey.title,
        )
        return Response(SurveySerializer(survey, context={'request': request}).data)


class AdminSurveyResultsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        ck = key_survey_results(pk)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        results = calculate_survey_results(survey, request)
        payload = {
            'survey': SurveySerializer(survey, context={'request': request}).data,
            'results': results,
        }
        cache.set(ck, payload, settings.CACHE_TTL_SURVEY_RESULTS)
        return Response(payload)


class AdminSurveyExportCSVView(APIView):
    """Export survey results as a UTF-8 CSV (BOM for Excel compatibility).

    The CSV is the full raw dataset. To stay scalable when a single question
    collects hundreds of comments, the per-question columns in the individual
    section carry only the comment COUNT; every comment is listed in full,
    one row each, in the dedicated comments section at the bottom.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        ds = build_export_dataset(survey, request)
        results, questions = ds['results'], ds['questions']
        comments_map, summary = ds['comments_map'], ds['summary']
        questions_meta = ds['questions_meta']

        response = HttpResponse(content_type='text/csv; charset=utf-8-sig')
        response['Content-Disposition'] = f'attachment; filename="survey_{pk}_results.csv"'
        log_activity(
            ActivityActions.EXPORT_CSV,
            request=request,
            description=f'خروجی CSV نتایج نظرسنجی «{survey.title}»',
            target_type='survey',
            target_id=survey.id,
            target_repr=survey.title,
            metadata={'export_format': 'csv'},
        )
        writer = csv.writer(response)

        # ── Section 1: individual ranking ──
        headers = ['رتبه', 'نام و نام خانوادگی', 'واحد سازمانی', 'سمت',
                   'میانگین کلی', 'کیفیت', 'تعداد رأی‌دهنده', 'تعداد پاسخ امتیازی']
        for q in questions:
            if q.has_score:
                headers.append(f"میانگین: {q.text}")
                headers.append(f"تعداد پاسخ: {q.text}")
            if q.has_comment:
                headers.append(f"تعداد نظرات: {q.text}")
        writer.writerow(headers)

        for r in results:
            row = [
                r['rank'], r['full_name'], r['department'] or '', r['role_title'] or '',
                r['average_score'] if r['average_score'] is not None else '',
                score_grade(r['average_score']),
                r['votes_count'], r['scored_answers_count'],
            ]
            by_q = {item['question_id']: item for item in r.get('question_results', [])}
            for q in questions:
                item = by_q.get(q.id, {})
                if q.has_score:
                    row.append(item.get('average_score') if item.get('average_score') is not None else '')
                    row.append(item.get('responses_count') or 0)
                if q.has_comment:
                    # only the count here — full text lives in the comments section
                    row.append(len(comments_map.get((r['person_id'], q.id), [])))
            writer.writerow(row)

        # ── Section 2: question-by-question summary ──
        writer.writerow([])
        writer.writerow(['تحلیل سوال‌به‌سوال'])
        writer.writerow(['#', 'متن سوال', 'میانگین کل', 'کیفیت', 'تعداد پاسخ', 'تعداد نظرات متنی'])
        for idx, q in enumerate(questions_meta, 1):
            writer.writerow([
                idx, q['text'],
                q['avg'] if q['avg'] is not None else ('متنی' if not q['has_score'] else ''),
                score_grade(q['avg']) if q['has_score'] else '—',
                q['responses'] if q['has_score'] else '—',
                q['comments'] if q['has_comment'] else '—',
            ])

        # ── Section 3: score distribution ──
        writer.writerow([])
        writer.writerow(['توزیع امتیازات'])
        writer.writerow(['دسته', 'تعداد افراد'])
        for label, count, _color in summary['distribution']:
            writer.writerow([label, count])

        # ── Section 4: full textual comments (one row each — scales freely) ──
        if ds['comments_flat']:
            writer.writerow([])
            writer.writerow([f"نظرات متنی (مجموع {summary['total_comments']})"])
            writer.writerow(['نام فرد ارزیابی‌شده', 'واحد سازمانی', 'سوال', 'نظر'])
            for person_name, dept, q_text, comment in ds['comments_flat']:
                writer.writerow([person_name, dept, q_text, comment])

        return response


class AdminSurveyExportExcelView(APIView):
    """Export survey results as a styled multi-sheet Excel workbook.

    Visual language matches the PDF report (indigo brand header, KPI summary,
    score distribution, colour-graded scores). Every comment is preserved on a
    dedicated sheet — one row per comment — which scales to hundreds of
    comments per question without bloating the grid sheets (those carry counts).
    """
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        if not HAS_OPENPYXL:
            return Response({'detail': 'خروجی اکسل در دسترس نیست.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        from openpyxl.utils import get_column_letter

        ds = build_export_dataset(survey, request)
        results, questions = ds['results'], ds['questions']
        comments_map, summary = ds['comments_map'], ds['summary']
        questions_meta = ds['questions_meta']

        # ── brand palette (matches the PDF) ──
        BRAND_FILL    = PatternFill('solid', fgColor='4F46E5')   # indigo
        BRAND2_FILL   = PatternFill('solid', fgColor='7C3AED')   # violet
        HEADER_FILL   = PatternFill('solid', fgColor='1E293B')   # slate-800
        HEADER_FONT   = Font(name='Calibri', bold=True, color='FFFFFF', size=10)
        SUBHEAD_FILL  = PatternFill('solid', fgColor='334155')
        SUBHEAD_FONT  = Font(bold=True, color='FFFFFF', size=10)
        BRAND_FONT    = Font(bold=True, color='FFFFFF', size=15)
        SUBTITLE_FONT = Font(color='E0E7FF', size=10)
        TITLE_FONT    = Font(bold=True, size=13, color='1E293B')
        MUTED_FONT    = Font(color='64748B', size=9)
        CENTER        = Alignment(horizontal='center', vertical='center', wrap_text=True)
        RIGHT         = Alignment(horizontal='right', vertical='center', wrap_text=True)
        THIN          = Side(style='thin', color='E2E8F0')
        BORDER        = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

        def score_fill(score):
            if score is None: return PatternFill('solid', fgColor='F8FAFC')
            if score < 4:     return PatternFill('solid', fgColor='FEF2F2')
            if score < 7:     return PatternFill('solid', fgColor='FFFBEB')
            return             PatternFill('solid', fgColor='F0FDF4')

        def score_font(score):
            if score is None: return Font(color='94A3B8', bold=True, size=10)
            if score < 4:     return Font(color='EF4444', bold=True, size=10)
            if score < 7:     return Font(color='F59E0B', bold=True, size=10)
            return             Font(color='10B981', bold=True, size=10)

        def style_header_row(ws, row_num, fill, font, height=22):
            ws.row_dimensions[row_num].height = height
            for cell in ws[row_num]:
                cell.fill = fill
                cell.font = font
                cell.alignment = CENTER
                cell.border = BORDER

        wb = openpyxl.Workbook()

        # ═══════════════════════════════════════════════════════════
        # Sheet 1: خلاصه  (KPI summary + distribution — matches PDF)
        # ═══════════════════════════════════════════════════════════
        ws0 = wb.active
        ws0.title = 'خلاصه'
        ws0.sheet_view.rightToLeft = True
        ws0.sheet_view.showGridLines = False

        # Brand header band
        ws0.merge_cells('A1:D2')
        ws0['A1'] = f'نتایج نظرسنجی: {survey.title}'
        ws0['A1'].fill = BRAND_FILL
        ws0['A1'].font = BRAND_FONT
        ws0['A1'].alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        for r_ in (1, 2):
            for c_ in range(1, 5):
                ws0.cell(row=r_, column=c_).fill = BRAND_FILL
        ws0.row_dimensions[1].height = 26
        ws0.row_dimensions[2].height = 14
        ws0.merge_cells('A3:D3')
        ws0['A3'] = 'گزارش تحلیلی نتایج نظرسنجی'
        ws0['A3'].fill = BRAND2_FILL
        ws0['A3'].font = SUBTITLE_FONT
        ws0['A3'].alignment = Alignment(horizontal='center', vertical='center')
        for c_ in range(1, 5):
            ws0.cell(row=3, column=c_).fill = BRAND2_FILL
        ws0.row_dimensions[3].height = 18

        avg = summary['overall_avg']
        kpis = [
            ('میانگین کل', avg if avg is not None else '—'),
            ('سوالات فعال', summary['questions']),
            ('افراد ارزیابی‌شونده', summary['people']),
            ('رأی‌دهندگان کامل', summary['voters']),
        ]
        # KPI value row (5) + label row (6)
        for i, (label, value) in enumerate(kpis, 1):
            vc = ws0.cell(row=5, column=i, value=value)
            vc.alignment = CENTER
            vc.font = Font(bold=True, size=16, color='4F46E5')
            vc.border = BORDER
            if i == 1 and isinstance(value, (int, float)):
                vc.font = score_font(avg); vc.fill = score_fill(avg)
            lc = ws0.cell(row=6, column=i, value=label)
            lc.alignment = CENTER
            lc.font = MUTED_FONT
            lc.border = BORDER
        ws0.row_dimensions[5].height = 30
        ws0.row_dimensions[6].height = 18

        # Best / worst
        ws0.cell(row=8, column=1, value='بهترین امتیاز').font = SUBHEAD_FONT
        ws0.cell(row=8, column=1).fill = SUBHEAD_FILL
        ws0.cell(row=8, column=2, value=summary['best'] if summary['best'] is not None else '—').alignment = CENTER
        ws0.cell(row=9, column=1, value='ضعیف‌ترین امتیاز').font = SUBHEAD_FONT
        ws0.cell(row=9, column=1).fill = SUBHEAD_FILL
        ws0.cell(row=9, column=2, value=summary['worst'] if summary['worst'] is not None else '—').alignment = CENTER

        # Distribution table
        ws0.merge_cells('A11:D11')
        ws0['A11'] = 'توزیع امتیازات'
        ws0['A11'].font = TITLE_FONT
        ws0['A11'].alignment = RIGHT
        dist_hdr = 12
        ws0.cell(row=dist_hdr, column=1, value='دسته')
        ws0.cell(row=dist_hdr, column=2, value='تعداد افراد')
        ws0.cell(row=dist_hdr, column=3, value='درصد')
        style_header_row(ws0, dist_hdr, HEADER_FILL, HEADER_FONT)
        dist_total = sum(c for _l, c, _col in summary['distribution']) or 1
        rr = dist_hdr + 1
        for label, count, color in summary['distribution']:
            ws0.cell(row=rr, column=1, value=label).alignment = RIGHT
            cc = ws0.cell(row=rr, column=2, value=count); cc.alignment = CENTER
            pc = ws0.cell(row=rr, column=3, value=f'{round(count / dist_total * 100)}٪'); pc.alignment = CENTER
            chip = ws0.cell(row=rr, column=1)
            chip.fill = PatternFill('solid', fgColor=color.lstrip('#').upper())
            chip.font = Font(color='FFFFFF', bold=True, size=10)
            for c_ in range(1, 4):
                ws0.cell(row=rr, column=c_).border = BORDER
            rr += 1
        ws0.column_dimensions['A'].width = 26
        ws0.column_dimensions['B'].width = 18
        ws0.column_dimensions['C'].width = 14
        ws0.column_dimensions['D'].width = 22

        # ═══════════════════════════════════════════════════════════
        # Sheet 2: نتایج فردی  (ranking + per-question)
        # ═══════════════════════════════════════════════════════════
        ws1 = wb.create_sheet('نتایج فردی')
        ws1.sheet_view.rightToLeft = True

        ws1.append([f'رتبه‌بندی افراد: {survey.title}'])
        base_cols = ['رتبه', 'نام و نام خانوادگی', 'واحد سازمانی', 'سمت',
                     'میانگین کلی', 'کیفیت', 'رأی‌دهنده', 'پاسخ امتیازی']
        ncols = len(base_cols)
        q_headers = []
        for q in questions:
            if q.has_score:
                q_headers.append(f"میانگین\n{q.text}")
                q_headers.append(f"تعداد پاسخ\n{q.text}")
            if q.has_comment:
                q_headers.append(f"تعداد نظرات\n{q.text}")
        ncols += len(q_headers)
        ws1.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncols)
        ws1['A1'].font = TITLE_FONT
        ws1['A1'].alignment = RIGHT
        ws1.row_dimensions[1].height = 26
        ws1.append([])
        ws1.append(base_cols + q_headers)
        style_header_row(ws1, 3, HEADER_FILL, HEADER_FONT, height=40 if q_headers else 22)

        for r in results:
            avg_v = r['average_score']
            row = [
                r['rank'], r['full_name'], r['department'] or '', r['role_title'] or '',
                round(avg_v, 2) if avg_v is not None else '',
                score_grade(avg_v),
                r['votes_count'], r.get('scored_answers_count') or 0,
            ]
            by_q = {item['question_id']: item for item in r.get('question_results', [])}
            for q in questions:
                item = by_q.get(q.id, {})
                if q.has_score:
                    q_avg = item.get('average_score')
                    row.append(round(q_avg, 2) if q_avg is not None else '')
                    row.append(item.get('responses_count') or 0)
                if q.has_comment:
                    row.append(len(comments_map.get((r['person_id'], q.id), [])))
            ws1.append(row)
            data_row = ws1.max_row
            ws1.row_dimensions[data_row].height = 18
            for col_idx, cell in enumerate(ws1[data_row], 1):
                cell.border = BORDER
                cell.alignment = CENTER if col_idx in (1, 5, 6, 7, 8) else RIGHT
                if col_idx == 5:
                    cell.fill = score_fill(avg_v); cell.font = score_font(avg_v)
                elif col_idx == 6:
                    cell.font = score_font(avg_v)
            # colour per-question average cells
            offset = len(base_cols)
            for q in questions:
                if q.has_score:
                    q_avg_val = by_q.get(q.id, {}).get('average_score')
                    cell = ws1.cell(row=data_row, column=offset + 1)
                    cell.fill = score_fill(q_avg_val); cell.font = score_font(q_avg_val)
                    offset += 2
                if q.has_comment:
                    offset += 1

        ws1.freeze_panes = 'A4'
        ws1.auto_filter.ref = f'A3:{get_column_letter(ncols)}3'
        for col, w in (('A', 8), ('B', 24), ('C', 18), ('D', 18), ('E', 12), ('F', 10), ('G', 10), ('H', 12)):
            ws1.column_dimensions[col].width = w
        for ci in range(len(base_cols) + 1, ncols + 1):
            ws1.column_dimensions[get_column_letter(ci)].width = 14

        # ═══════════════════════════════════════════════════════════
        # Sheet 3: تحلیل سوال‌ها
        # ═══════════════════════════════════════════════════════════
        ws2 = wb.create_sheet('تحلیل سوال‌ها')
        ws2.sheet_view.rightToLeft = True
        ws2.append([f'تحلیل سوال‌به‌سوال: {survey.title}'])
        ws2.merge_cells('A1:F1')
        ws2['A1'].font = TITLE_FONT
        ws2['A1'].alignment = RIGHT
        ws2.row_dimensions[1].height = 26
        ws2.append([])
        ws2.append(['#', 'متن سوال', 'میانگین کل', 'کیفیت', 'تعداد پاسخ', 'تعداد نظرات متنی'])
        style_header_row(ws2, 3, HEADER_FILL, HEADER_FONT)
        for idx, q in enumerate(questions_meta, 1):
            q_avg = q['avg']
            ws2.append([
                idx, q['text'],
                q_avg if q_avg is not None else 'متنی',
                score_grade(q_avg) if q['has_score'] else '—',
                q['responses'] if q['has_score'] else '—',
                q['comments'] if q['has_comment'] else '—',
            ])
            row_num = ws2.max_row
            ws2.row_dimensions[row_num].height = 20
            for col_idx, cell in enumerate(ws2[row_num], 1):
                cell.border = BORDER
                cell.alignment = CENTER if col_idx in (1, 3, 4, 5, 6) else RIGHT
                if col_idx == 3 and isinstance(cell.value, (int, float)):
                    cell.fill = score_fill(q_avg); cell.font = score_font(q_avg)
                elif col_idx == 4 and q['has_score']:
                    cell.font = score_font(q_avg)
        ws2.freeze_panes = 'A4'
        ws2.auto_filter.ref = 'A3:F3'
        for col, w in (('A', 6), ('B', 46), ('C', 14), ('D', 12), ('E', 14), ('F', 16)):
            ws2.column_dimensions[col].width = w

        # ═══════════════════════════════════════════════════════════
        # Sheet 4: نظرات متنی  (one row per comment — full fidelity)
        # ═══════════════════════════════════════════════════════════
        if ds['comments_flat']:
            ws3 = wb.create_sheet('نظرات متنی')
            ws3.sheet_view.rightToLeft = True
            ws3.append([f"نظرات متنی: {survey.title}  (مجموع {summary['total_comments']})"])
            ws3.merge_cells('A1:E1')
            ws3['A1'].font = TITLE_FONT
            ws3['A1'].alignment = RIGHT
            ws3.row_dimensions[1].height = 26
            ws3.append([])
            ws3.append(['#', 'نام فرد ارزیابی‌شده', 'واحد سازمانی', 'سوال', 'نظر'])
            style_header_row(ws3, 3, SUBHEAD_FILL, SUBHEAD_FONT)
            for i, (person_name, dept, q_text, comment) in enumerate(ds['comments_flat'], 1):
                # defensive: Excel hard cell limit is 32,767 chars
                safe_comment = comment if len(comment) <= EXCEL_CELL_LIMIT else comment[:EXCEL_CELL_LIMIT] + '…'
                ws3.append([i, person_name, dept, q_text, safe_comment])
                row_num = ws3.max_row
                for col_idx, cell in enumerate(ws3[row_num], 1):
                    cell.border = BORDER
                    cell.alignment = CENTER if col_idx == 1 else RIGHT
            ws3.freeze_panes = 'A4'
            ws3.auto_filter.ref = 'A3:E3'
            for col, w in (('A', 6), ('B', 22), ('C', 16), ('D', 32), ('E', 60)):
                ws3.column_dimensions[col].width = w

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="survey_{pk}_results.xlsx"'
        log_activity(
            ActivityActions.EXPORT_EXCEL,
            request=request,
            description=f'خروجی Excel نتایج نظرسنجی «{survey.title}»',
            target_type='survey',
            target_id=survey.id,
            target_repr=survey.title,
            metadata={'export_format': 'excel'},
        )
        return response


class AdminSurveyExportPDFView(APIView):
    """Export survey results as a beautiful, comprehensive RTL PDF report.

    The PDF is an executive summary: comments are grouped by question and
    capped (PDF_MAX_COMMENTS_PER_QUESTION / PDF_MAX_TOTAL_COMMENTS) so the
    document stays readable and bounded even when a question gathers hundreds
    of comments. Readers are pointed to the Excel/CSV export for the full list.
    """
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        if not HAS_PDF:
            return Response({'detail': 'خروجی PDF در دسترس نیست.'}, status=status.HTTP_501_NOT_IMPLEMENTED)

        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            ds = build_export_dataset(survey, request)
            comment_groups, truncated = build_pdf_comment_groups(ds)
            pdf_bytes = build_survey_pdf(
                survey, ds['results'], ds['questions_meta'],
                comment_groups, ds['summary'], comments_truncated=truncated,
            )
        except Exception:
            # Surface a readable JSON error instead of a raw 500/HTML page so the
            # client shows a meaningful message rather than the generic toast.
            logger.exception('PDF export failed for survey %s', pk)
            return Response(
                {'detail': 'خطا در تولید خروجی PDF. لطفاً دوباره تلاش کنید یا خروجی Excel/CSV را امتحان کنید.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        log_activity(
            ActivityActions.EXPORT_PDF,
            request=request,
            description=f'خروجی PDF نتایج نظرسنجی «{survey.title}»',
            target_type='survey',
            target_id=survey.id,
            target_repr=survey.title,
            metadata={'export_format': 'pdf'},
        )

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="survey_{pk}_results.pdf"'
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

        # FIX #2: Check completeness correctly — only block if the voter has already
        # answered ALL active questions for this person (a full, completed submission).
        # The old check (.exists() on any rating) blocked voters from finishing
        # multi-question surveys after a partial save, which was a serious UX bug.
        existing_answer_count = Rating.objects.filter(
            survey=survey, person=person, voter=request.user,
            question__is_active=True,
        ).count()
        if existing_answer_count >= len(questions):
            return Response({'detail': 'شما قبلاً برای این فرد پاسخ ثبت کرده‌اید.'}, status=status.HTTP_400_BAD_REQUEST)

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

        invalidate_survey_results(survey.id)
        invalidate_dashboard()
        invalidate_employee_survey_list(request.user.id)
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
        ck = key_dashboard()
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        from apps.accounts.models import User

        total_surveys = Survey.objects.count()
        draft_surveys = Survey.objects.filter(status=Survey.STATUS_DRAFT).count()
        published_surveys = Survey.objects.filter(status=Survey.STATUS_PUBLISHED).count()
        closed_surveys = Survey.objects.filter(status=Survey.STATUS_CLOSED).count()
        # Count voters who fully completed at least one survey
        from django.db.models import Count as DCount, F as DF, Q as DQ
        # FIX #9: N+1 query replaced — the old loop fired one Rating query per survey
        # (100 surveys = 100 DB queries). Now we compute required answers per survey
        # in Python and count completed voters in a single annotated query.
        from django.db.models import Count as _Count, F as _F, Q as _Q
        survey_meta = list(
            Survey.objects
            .annotate(
                ap=_Count('people', filter=_Q(people__is_active=True), distinct=True),
                aq=_Count('questions', filter=_Q(questions__is_active=True), distinct=True),
            )
            .values('id', 'ap', 'aq')
        )
        required_by_survey = {
            s['id']: s['ap'] * s['aq'] for s in survey_meta if s['ap'] * s['aq'] > 0
        }
        voter_answer_counts = (
            Rating.objects
            .filter(
                survey_id__in=required_by_survey.keys(),
                person__is_active=True,
                question__is_active=True,
            )
            .values('survey_id', 'voter_id')
            .annotate(answered_count=DCount('id', distinct=True))
        )
        total_responses = sum(
            1
            for row in voter_answer_counts
            if row['answered_count'] >= required_by_survey.get(row['survey_id'], 0)
        )
        total_employees = User.objects.filter(role='employee').count()

        recent_surveys = Survey.objects.order_by('-created_at')[:5]
        recent_data = SurveySerializer(recent_surveys, many=True, context={'request': request}).data

        payload = {
            'stats': {
                'total_surveys': total_surveys,
                'draft_surveys': draft_surveys,
                'published_surveys': published_surveys,
                'closed_surveys': closed_surveys,
                'total_responses': total_responses,
                'total_employees': total_employees,
            },
            'recent_surveys': recent_data,
        }
        cache.set(ck, payload, settings.CACHE_TTL_DASHBOARD)
        return Response(payload)


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
        log_activity(
            ActivityActions.DELETE_ALL_DATA,
            request=request,
            description=(
                f'حذف تمام داده‌ها: {surveys_count} نظرسنجی، '
                f'{ratings_count} پاسخ، {employees_count} کارمند'
            ),
            target_type='system',
            target_repr='کل داده‌های سیستم',
            metadata={
                'surveys': surveys_count,
                'people': people_count,
                'ratings': ratings_count,
                'employees': employees_count,
            },
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


class AdminSurveyCommentsView(APIView):
    """Paginated comments for a specific person (and optionally question) in a survey.

    GET /admin/surveys/<pk>/comments/?person_id=<id>&question_id=<id>&page=1&page_size=20
    """
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            survey = Survey.objects.get(pk=pk)
        except Survey.DoesNotExist:
            return Response({'detail': 'نظرسنجی یافت نشد.'}, status=status.HTTP_404_NOT_FOUND)

        person_id   = request.query_params.get('person_id')
        question_id = request.query_params.get('question_id')
        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = min(100, max(1, int(request.query_params.get('page_size', 20))))
        except (ValueError, TypeError):
            page, page_size = 1, 20

        # Completed voters only
        active_people_count    = survey.people.filter(is_active=True).count()
        active_questions_count = survey.questions.filter(is_active=True).count()
        required = active_people_count * active_questions_count

        if required > 0:
            completed_voter_ids = list(
                Rating.objects
                .filter(survey=survey, person__is_active=True, question__is_active=True)
                .values('voter_id')
                .annotate(answered_count=Count('id', distinct=True))
                .filter(answered_count=required)
                .values_list('voter_id', flat=True)
            )
        else:
            completed_voter_ids = []

        qs = Rating.objects.filter(
            survey=survey,
            person__is_active=True,
            question__is_active=True,
            voter_id__in=completed_voter_ids,
        ).exclude(comment__isnull=True).exclude(comment__exact='')

        if person_id:
            qs = qs.filter(person_id=person_id)
        if question_id:
            qs = qs.filter(question_id=question_id)

        qs = qs.order_by('person_id', 'question__display_order', 'created_at')

        total = qs.count()
        offset = (page - 1) * page_size
        comments_page = list(qs.values('comment', 'question__text')[offset:offset + page_size])

        return Response({
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'comments': [
                {'comment': row['comment'], 'question_text': row['question__text']}
                for row in comments_page
            ],
        })
