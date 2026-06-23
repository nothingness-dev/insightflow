   
import datetime as dt
import logging

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminUser

from django.conf import settings
from django.core.cache import cache
from apps.core.cache import (
    key_activity_stats, key_activity_charts, key_activity_filter_options,
    invalidate_activity_stats, invalidate_filter_options,
)

from .models import ACTION_LABELS, CRITICAL_ACTIONS, ActivityLog
from .serializers import ActivityLogSerializer

logger = logging.getLogger('apps')


class ActivityLogPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _parse_boundary(value, end_of_day=False):
    """Parse a 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM[:SS]' string into an aware datetime.

    Naive inputs are interpreted in the project's local timezone. For a bare
    date used as an upper bound, the whole day is included.
    """
    if not value:
        return None
    value = value.strip()
    parsed = None

    for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            parsed = dt.datetime.strptime(value, fmt)
            date_only = (fmt == '%Y-%m-%d')
            break
        except ValueError:
            continue
    if parsed is None:
        return None
    if end_of_day and date_only:
        parsed = parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def build_activity_queryset(params):
    """Apply search + filters from query params and return a filtered queryset.

    Shared by the list endpoint and the export center so they stay consistent.
    """
    qs = ActivityLog.objects.select_related('actor').all()

    search = (params.get('search') or '').strip()
    if search:
        qs = qs.filter(
            Q(description__icontains=search)
            | Q(actor_username__icontains=search)
            | Q(actor_full_name__icontains=search)
            | Q(target_repr__icontains=search)
            | Q(ip_address__icontains=search)
        )

    action = (params.get('action') or '').strip()
    if action and action in ACTION_LABELS:
        qs = qs.filter(action=action)

    status_filter = (params.get('status') or '').strip()
    if status_filter in (ActivityLog.STATUS_SUCCESS, ActivityLog.STATUS_FAILED):
        qs = qs.filter(status=status_filter)

    actor_id = (params.get('actor') or '').strip()
    if actor_id.isdigit():
        qs = qs.filter(actor_id=int(actor_id))

    critical = (params.get('is_critical') or '').strip().lower()
    if critical in ('1', 'true', 'yes'):
        qs = qs.filter(is_critical=True)

    date_from = _parse_boundary(params.get('date_from'))
    if date_from:
        qs = qs.filter(created_at__gte=date_from)
    date_to = _parse_boundary(params.get('date_to'), end_of_day=True)
    if date_to:
        qs = qs.filter(created_at__lte=date_to)

    return qs.order_by('-created_at')


class ActivityLogListView(APIView):
    """Paginated, filterable, searchable activity log table (server-side)."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        qs = build_activity_queryset(request.query_params)
        paginator = ActivityLogPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = ActivityLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class ActivityStatsView(APIView):
    """Headline KPIs: total, today, this week, most active admin."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        ck = key_activity_stats()
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        now = timezone.localtime()
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        days_since_saturday = (now.weekday() - 5) % 7
        start_of_week = start_of_today - dt.timedelta(days=days_since_saturday)

        total = ActivityLog.objects.count()
        today = ActivityLog.objects.filter(created_at__gte=start_of_today).count()
        this_week = ActivityLog.objects.filter(created_at__gte=start_of_week).count()
        critical_total = ActivityLog.objects.filter(is_critical=True).count()
        failed_total = ActivityLog.objects.filter(status=ActivityLog.STATUS_FAILED).count()

        most_active = (
            ActivityLog.objects
            .filter(actor__isnull=False)
            .values('actor_id', 'actor_username', 'actor_full_name')
            .annotate(count=Count('id'))
            .order_by('-count')
            .first()
        )
        most_active_admin = None
        if most_active:
            most_active_admin = {
                'actor_id': most_active['actor_id'],
                'username': most_active['actor_username'],
                'full_name': most_active['actor_full_name'],
                'count': most_active['count'],
            }

        payload = {
            'total_activities': total,
            'today_activities': today,
            'week_activities': this_week,
            'critical_activities': critical_total,
            'failed_activities': failed_total,
            'most_active_admin': most_active_admin,
        }
        cache.set(ck, payload, settings.CACHE_TTL_ACTIVITY_STATS)
        return Response(payload)


class ActivityTimelineView(APIView):
    """Most recent activities for the timeline widget."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            limit = min(50, max(1, int(request.query_params.get('limit', 15))))
        except (TypeError, ValueError):
            limit = 15
        qs = ActivityLog.objects.select_related('actor').order_by('-created_at')[:limit]
        return Response(ActivityLogSerializer(qs, many=True).data)


class ActivityCriticalView(APIView):
    """Recent critical actions for the dedicated panel."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            limit = min(50, max(1, int(request.query_params.get('limit', 10))))
        except (TypeError, ValueError):
            limit = 10
        qs = (
            ActivityLog.objects
            .select_related('actor')
            .filter(is_critical=True)
            .order_by('-created_at')[:limit]
        )
        return Response({
            'count': ActivityLog.objects.filter(is_critical=True).count(),
            'items': ActivityLogSerializer(qs, many=True).data,
        })


class ActivityChartsView(APIView):
    """Aggregate data for charts: daily volume + breakdown by action type."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            days = min(60, max(7, int(request.query_params.get('days', 14))))
        except (TypeError, ValueError):
            days = 14

        ck = key_activity_charts(days)
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        now = timezone.localtime()
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        window_start = start_of_today - dt.timedelta(days=days - 1)

        rows = (
            ActivityLog.objects
            .filter(created_at__gte=window_start)
            .values_list('created_at', 'status')
        )
        buckets = {}
        for i in range(days):
            day = (window_start + dt.timedelta(days=i)).date()
            buckets[day] = {'date': day.isoformat(), 'total': 0, 'failed': 0}
        for created_at, row_status in rows:
            day = timezone.localtime(created_at).date()
            bucket = buckets.get(day)
            if bucket is None:
                continue
            bucket['total'] += 1
            if row_status == ActivityLog.STATUS_FAILED:
                bucket['failed'] += 1
        daily = [buckets[(window_start + dt.timedelta(days=i)).date()] for i in range(days)]

        by_action_rows = (
            ActivityLog.objects
            .values('action')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        by_action = [
            {
                'action': row['action'],
                'label': ACTION_LABELS.get(row['action'], row['action']),
                'count': row['count'],
            }
            for row in by_action_rows
        ]

        payload = {'days': days, 'daily': daily, 'by_action': by_action}
        cache.set(ck, payload, settings.CACHE_TTL_ACTIVITY_CHARTS)
        return Response(payload)


class ActivityFilterOptionsView(APIView):
    """Options for the filter UI: action types, statuses and known actors."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        ck = key_activity_filter_options()
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

        actions = [
            {'value': code, 'label': label, 'critical': code in CRITICAL_ACTIONS}
            for code, label in ACTION_LABELS.items()
        ]

        actor_ids = (
            ActivityLog.objects
            .filter(actor__isnull=False)
            .values_list('actor_id', flat=True)
            .distinct()
        )
        actors = [
            {'id': u.id, 'username': u.username, 'full_name': u.full_name}
            for u in User.objects.filter(id__in=list(actor_ids)).order_by('full_name', 'username')
        ]
        statuses = [
            {'value': ActivityLog.STATUS_SUCCESS, 'label': 'موفق'},
            {'value': ActivityLog.STATUS_FAILED, 'label': 'ناموفق'},
        ]
        payload = {'actions': actions, 'actors': actors, 'statuses': statuses}
        cache.set(ck, payload, settings.CACHE_TTL_FILTER_OPTIONS)
        return Response(payload)


class ActivityExportView(APIView):
    """Export center: download activity logs within a date range as CSV/Excel/PDF.

    ``from_date`` and ``to_date`` are REQUIRED — the export is always scoped to a
    range so it never dumps the entire table.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):

        export_format = (request.query_params.get('export_format') or 'csv').strip().lower()
        if export_format not in ('csv', 'excel', 'pdf'):
            return Response(
                {'detail': 'فرمت خروجی نامعتبر است. فقط CSV، Excel و PDF مجاز هستند.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        date_to = _parse_boundary(request.query_params.get('date_to'), end_of_day=True)
        if date_to is None:
            date_to = timezone.now()

        date_from = _parse_boundary(request.query_params.get('date_from'))
        if date_from is None:
            date_from = date_to - dt.timedelta(days=30)

        if date_from > date_to:
            return Response(
                {'detail': '«از تاریخ» نمی‌تواند بعد از «تا تاریخ» باشد.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = build_activity_queryset(request.query_params)

        try:
            from .exports import export_activity_logs
            content, content_type, filename = export_activity_logs(qs, export_format, date_from, date_to)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_501_NOT_IMPLEMENTED)
        except Exception:
            logger.exception('Activity export failed (format=%s)', export_format)
            return Response(
                {'detail': 'خطا در تولید فایل خروجی گزارش فعالیت‌ها. لطفاً دوباره تلاش کنید.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        from django.http import HttpResponse
        from .services import log_activity
        from .models import ActivityActions

        action_map = {
            'csv': ActivityActions.EXPORT_CSV,
            'excel': ActivityActions.EXPORT_EXCEL,
            'pdf': ActivityActions.EXPORT_PDF,
        }
        log_activity(
            action=action_map[export_format],
            request=request,
            description=f'خروجی {export_format.upper()} گزارش فعالیت‌ها',
            target_type='activity_export',
            target_repr='گزارش فعالیت‌ها',
            metadata={
                'format': export_format,
                'from': date_from.date().isoformat(),
                'to': date_to.date().isoformat(),
                'row_count': qs.count(),
            },
        )

        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
