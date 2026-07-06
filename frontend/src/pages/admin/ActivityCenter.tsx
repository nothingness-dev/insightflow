import { Fragment, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { activityApi } from '../../api/endpoints';
import {
  EmptyState, Modal, PageHeader, SearchInput, Select, Skeleton, Spinner,
} from '../../components/common';
import {
  ActivityCharts, ActivityCriticalPanel, ActivityFilterOptions,
  ActivityLog, ActivityLogFilters, ActivityStats,
} from '../../types';
import { downloadBlob, formatDateTime, formatNumber, getBlobErrorMessage, getErrorMessage, toPersianDigits } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';

const PAGE_SIZE = 20;


function StatCard({ label, value, accent, icon }: { label: string; value: string | number; accent: string; icon: JSX.Element }) {
  return (
    <div className="card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: 'success' | 'failed' }) {
  return status === 'failed'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">ناموفق</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">موفق</span>;
}

function actionDotColor(action: string, isCritical: boolean) {
  if (isCritical) return 'bg-red-500';
  if (action.startsWith('survey')) return 'bg-indigo-500';
  if (action.startsWith('question') || action.startsWith('person')) return 'bg-violet-500';
  if (action.startsWith('export')) return 'bg-amber-500';
  if (action.startsWith('user') || action.includes('password') || action.includes('import')) return 'bg-sky-500';
  if (action.startsWith('login') || action === 'logout') return 'bg-emerald-500';
  return 'bg-slate-400';
}


const Ic = {
  total: <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3 8 4-16 3 8h4" /></svg>,
  today: <svg className="w-5 h-5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  week: <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  admin: <svg className="w-5 h-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  warn: <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>,
};

const METADATA_KEY_LABELS: Record<string, string> = {
  token: 'Link token',
  label: 'Link name',
  is_active: 'Active status',
  max_participants: 'Max participants',
  expiry_value: 'Expiry value',
  expiry_unit: 'Expiry unit',
  ip_address: 'IP address',
  survey_id: 'Survey ID',
  person_id: 'Person ID',
  question_id: 'Question ID',
  file_format: 'File format',
  count: 'Count',
  reason: 'Reason',
  person_name: 'Person name',
};

const EXPIRY_UNIT_EN: Record<string, string> = { hours: 'hours', days: 'days', weeks: 'weeks' };

// Identifiers / technical tokens are kept in Latin digits (like IP addresses) since
// they're copied, searched, or matched against raw system values rather than read as
// human quantities. Everything else — counts, durations, etc. — is shown in Persian digits.
const _RAW_DIGIT_KEYS = new Set(['token', 'person_id', 'survey_id', 'question_id', 'ip_address']);

function formatMetadataValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key === 'expiry_unit' && typeof value === 'string') return EXPIRY_UNIT_EN[value] || value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  return str;
}

function ActivityChartSkeleton() {
  const barHeights = [
    'h-20', 'h-28', 'h-16', 'h-32', 'h-24', 'h-36', 'h-28',
    'h-20', 'h-32', 'h-24', 'h-36', 'h-28', 'h-16', 'h-32',
  ];

  return (
    <div className="space-y-5" aria-busy="true">
      <div className="flex items-end gap-1.5 h-40" dir="ltr">
        {barHeights.map((heightClass, index) => (
          <div key={index} className="flex-1 flex flex-col items-center justify-end gap-1">
            <Skeleton className={`w-full rounded-t-md ${heightClass}`} />
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
      <div className="pt-5 border-t border-gray-100 space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-3 w-28 flex-shrink-0" />
            <Skeleton className="h-2.5 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CriticalActionsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100">
          <Skeleton className="w-5 h-5 rounded-full flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="relative border-r border-gray-200 pr-5 space-y-4" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="relative space-y-2">
          <Skeleton className="absolute -right-[26px] top-1 w-3 h-3 rounded-full ring-4 ring-white" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-40" />
        </div>
      ))}
    </div>
  );
}

function ActivityLogTableSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, index) => (
        <tr key={index}>
          <td className="px-3 py-3"><Skeleton className="h-3 w-24" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3 w-28" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3 w-24" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3 w-48" /></td>
          <td className="px-3 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3 w-20" /></td>
          <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>
        </tr>
      ))}
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DetailField({ label, value, icon, mono, dir, span }: {
  label: string; value: ReactNode; icon: JSX.Element; mono?: boolean; dir?: 'ltr' | 'rtl'; span?: boolean;
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 bg-white dark:bg-transparent border border-gray-100 dark:border-[color:var(--border-soft)] ${span ? 'sm:col-span-2' : ''}`}>
      <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-gray-50 dark:bg-[color:var(--border-soft)] text-gray-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
        <p className={`text-slate-700 font-medium truncate ${mono ? 'font-mono' : ''}`} dir={dir}>{value}</p>
      </div>
    </div>
  );
}

const DetailIc = {
  target: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ip: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a13.5 13.5 0 013 9 13.5 13.5 0 01-3 9 13.5 13.5 0 01-3-9 13.5 13.5 0 013-9z" /></svg>,
  browser: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>,
  info: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>,
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="text-gray-300 hover:text-[color:var(--c-600)] dark:hover:text-[color:var(--c-300)] transition-colors flex-shrink-0"
      title="کپی"
    >
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5A2.25 2.25 0 0117.25 21.75H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" /></svg>
      )}
    </button>
  );
}

function formatDetailDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function ActivityLogDetails({ log }: { log: ActivityLog }) {
  const metadataEntries = Object.entries(log.metadata || {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const isEmpty = metadataEntries.length === 0 && !log.target_repr && !log.ip_address && !log.user_agent;

  return (
    <div className="px-3 py-3 bg-slate-50/60 dark:bg-[color:var(--surface-alt)]/60 border-t border-b border-gray-100 dark:border-[color:var(--border-soft)] text-xs">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] font-semibold text-gray-400">Full event details</p>
        <p className="text-[11px] text-gray-400" dir="ltr">{formatDetailDateTime(log.created_at)}</p>
      </div>
      {isEmpty ? (
        <p className="text-gray-400 py-2">No additional information was recorded for this event.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {log.target_repr && (
            <DetailField label="Target" value={log.target_repr} icon={DetailIc.target} />
          )}
          {log.ip_address && (
            <DetailField
              label="Full IP address"
              icon={DetailIc.ip}
              mono
              dir="ltr"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {log.ip_address}
                  <CopyButton text={log.ip_address} />
                </span>
              }
            />
          )}
          {log.user_agent && (
            <DetailField label="Browser" value={log.user_agent} icon={DetailIc.browser} dir="ltr" span />
          )}
          {metadataEntries.map(([key, value]) => (
            <DetailField
              key={key}
              label={METADATA_KEY_LABELS[key] || key}
              value={formatMetadataValue(key, value)}
              icon={DetailIc.info}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ActivityCenter() {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [charts, setCharts] = useState<ActivityCharts | null>(null);
  const [critical, setCritical] = useState<ActivityCriticalPanel | null>(null);
  const [timeline, setTimeline] = useState<ActivityLog[]>([]);
  const [options, setOptions] = useState<ActivityFilterOptions | null>(null);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingTable, setLoadingTable] = useState(true);
  const [loadingTop, setLoadingTop] = useState(true);


  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actor, setActor] = useState('');
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const loadTop = useCallback(async (signal?: AbortSignal) => {
    setLoadingTop(true);
    try {
      const [s, c, cr, tl, opt] = await Promise.all([
        activityApi.stats(signal),
        activityApi.charts(14, signal),
        activityApi.critical(8, signal),
        activityApi.timeline(12, signal),
        activityApi.filterOptions(signal),
      ]);
      setStats(s.data);
      setCharts(c.data);
      setCritical(cr.data);
      setTimeline(tl.data);
      setOptions(opt.data);
    } catch (err) {
      if (isCanceledRequest(err, signal)) return;
      toast.error(getErrorMessage(err));
    } finally {
      if (!signal?.aborted) setLoadingTop(false);
    }
  }, []);

  const loadTable = useCallback(async (signal?: AbortSignal) => {
    setLoadingTable(true);
    try {
      const params: ActivityLogFilters = {
        page: String(page),
        page_size: String(PAGE_SIZE),
      };
      if (search) params.search = search;
      if (action) params.action = action;
      if (statusFilter) params.status = statusFilter;
      if (actor) params.actor = actor;
      if (criticalOnly) params.is_critical = 'true';
      const res = await activityApi.logs(params, signal);
      setLogs(res.data.results);
      setCount(res.data.count);
    } catch (err) {
      if (isCanceledRequest(err, signal)) return;
      toast.error(getErrorMessage(err));
    } finally {
      if (!signal?.aborted) setLoadingTable(false);
    }
  }, [page, search, action, statusFilter, actor, criticalOnly]);

  useEffect(() => {
    const controller = new AbortController();
    loadTop(controller.signal);
    return () => controller.abort();
  }, [loadTop]);
  useEffect(() => {
    const controller = new AbortController();
    loadTable(controller.signal);
    return () => controller.abort();
  }, [loadTable]);


  const onFilterChange = (fn: () => void) => { fn(); setPage(1); };

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const refreshAll = () => { loadTop(); loadTable(); toast.success('اطلاعات به‌روزرسانی شد'); };

  return (
    <div className="responsive-page max-w-6xl">
      <PageHeader
        title="مرکز فعالیت‌ها و گزارش‌های ممیزی"
        subtitle="رصد فعالیت‌های مهم سیستم و کاربران در یک نگاه"
        action={
          <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2">
            <button onClick={refreshAll} className="btn-secondary w-full min-[420px]:w-auto flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              به‌روزرسانی
            </button>
            <button onClick={() => setExportOpen(true)} className="btn-primary w-full min-[420px]:w-auto flex items-center gap-2">
              {Ic.download} مرکز خروجی
            </button>
          </div>
        }
      />
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatCard label="کل فعالیت‌ها" value={stats ? stats.total_activities.toLocaleString('fa-IR') : '—'} accent="bg-indigo-50" icon={Ic.total} />
        <StatCard label="فعالیت‌های امروز" value={stats ? stats.today_activities.toLocaleString('fa-IR') : '—'} accent="bg-sky-50" icon={Ic.today} />
        <StatCard label="فعالیت‌های این هفته" value={stats ? stats.week_activities.toLocaleString('fa-IR') : '—'} accent="bg-emerald-50" icon={Ic.week} />
        <StatCard
          label="فعال‌ترین مدیر"
          value={stats?.most_active_admin ? `${stats.most_active_admin.full_name || stats.most_active_admin.username}` : '—'}
          accent="bg-violet-50"
          icon={Ic.admin}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
<div className="lg:col-span-2 card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800">نمودار فعالیت‌ها (۱۴ روز اخیر)</h2>
            {stats && (
              <span className="text-xs text-gray-400">
                {stats.failed_activities.toLocaleString('fa-IR')} ناموفق · {stats.critical_activities.toLocaleString('fa-IR')} حساس
              </span>
            )}
          </div>
          {loadingTop ? (
            <ActivityChartSkeleton />
          ) : charts && charts.daily.length > 0 ? (
            <DailyChart data={charts.daily} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">داده‌ای برای نمایش وجود ندارد</p>
          )}

          {charts && charts.by_action.length > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-bold text-slate-800 mb-3">پرتکرارترین فعالیت‌ها</h3>
              <ActionBreakdown data={charts.by_action} />
            </div>
          )}
        </div>
<div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <h2 className="text-sm font-bold text-slate-800">اقدامات حساس</h2>
            {critical && <span className="text-xs text-gray-400">({critical.count.toLocaleString('fa-IR')})</span>}
          </div>
          {loadingTop ? (
            <CriticalActionsSkeleton />
          ) : critical && critical.items.length > 0 ? (
            <ul className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {critical.items.map(item => (
                <li key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50/50 border border-red-100">
                  {Ic.warn}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 leading-snug">{item.description || item.action_label}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{item.actor_display} · {formatDateTime(item.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">اقدام حساسی ثبت نشده است</p>
          )}
        </div>
      </div>
<div className="card p-4 sm:p-5 mb-5">
        <h2 className="text-sm font-bold text-slate-800 mb-4">جدول زمانی فعالیت‌ها</h2>
        {loadingTop ? (
          <TimelineSkeleton />
        ) : timeline.length > 0 ? (
          <ol className="relative border-r border-gray-200 pr-5 space-y-4">
            {timeline.map(item => (
              <li key={item.id} className="relative">
                <span className={`absolute -right-[26px] top-1 w-3 h-3 rounded-full ring-4 ring-white ${actionDotColor(item.action, item.is_critical)}`} />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-slate-700">{item.action_label}</span>
                  <StatusPill status={item.status} />
                  {item.is_critical && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">حساس</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{item.actor_display} · {formatDateTime(item.created_at)}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-gray-400 text-center py-6">فعالیتی ثبت نشده است</p>
        )}
      </div>
<div className="card p-4 sm:p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-4">گزارش کامل فعالیت‌ها</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="lg:col-span-2">
            <SearchInput value={search} onChange={handleSearch} placeholder="جستجو در شرح، کاربر یا IP..." />
          </div>
          <Select
            className="w-full"
            value={action}
            onChange={v => onFilterChange(() => setAction(v))}
            placeholder="همه فعالیت‌ها"
            options={[{ value: '', label: 'همه فعالیت‌ها' }, ...(options?.actions.map(a => ({ value: a.value, label: a.label })) || [])]}
          />
          <Select
            className="w-full"
            value={actor}
            onChange={v => onFilterChange(() => setActor(v))}
            placeholder="همه کاربران"
            options={[{ value: '', label: 'همه کاربران' }, ...(options?.actors.map(a => ({ value: String(a.id), label: a.full_name || a.username })) || [])]}
          />
          <Select
            className="w-full"
            value={statusFilter}
            onChange={v => onFilterChange(() => setStatusFilter(v))}
            placeholder="همه وضعیت‌ها"
            options={[{ value: '', label: 'همه وضعیت‌ها' }, ...(options?.statuses.map(s => ({ value: s.value, label: s.label })) || [])]}
          />
          <div className="flex items-center justify-between gap-3 lg:col-span-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none px-1">
              <input type="checkbox" checked={criticalOnly} onChange={e => onFilterChange(() => setCriticalOnly(e.target.checked))} className="w-4 h-4 rounded accent-red-500" />
              فقط اقدامات حساس
            </label>
            {(action || actor || statusFilter || criticalOnly || search) && (
              <button
                type="button"
                onClick={() => onFilterChange(() => { setAction(''); setActor(''); setStatusFilter(''); setCriticalOnly(false); handleSearch(''); })}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[color:var(--c-600)] dark:hover:text-[color:var(--c-300)] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                بازنشانی
              </button>
            )}
          </div>
        </div>

        <div className="table-wrapper overflow-x-auto rounded-lg border border-gray-100">
          <table className="responsive-table w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">زمان</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">فعالیت</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">کاربر</th>
                <th className="text-right font-medium px-3 py-2.5">شرح</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">وضعیت</th>
                <th className="text-right font-medium px-3 py-2.5 whitespace-nowrap">IP</th>
                <th className="w-8 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingTable ? (
                <ActivityLogTableSkeleton />
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="py-10">
                  <EmptyState title="فعالیتی یافت نشد" description="با فیلترهای انتخابی هیچ گزارشی موجود نیست." />
                </td></tr>
              ) : logs.map(log => {
                const isOpen = expandedId === log.id;
                const hasDetails = Boolean(log.target_repr || log.user_agent || Object.keys(log.metadata || {}).length > 0);
                return (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => hasDetails && setExpandedId(isOpen ? null : log.id)}
                      className={`${log.is_critical ? 'bg-red-50/40' : 'hover:bg-slate-50/60'} ${hasDetails ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${actionDotColor(log.action, log.is_critical)}`} />
                          <span className="text-xs font-medium text-slate-700">{log.action_label}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{log.actor_display}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[280px]"><span className="line-clamp-2">{log.description || '—'}</span></td>
                      <td className="px-3 py-2.5"><StatusPill status={log.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap" dir="ltr">{log.ip_address || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-300">
                        {hasDetails && <ChevronIcon open={isOpen} />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <ActivityLogDetails log={log} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
<div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 mt-4 text-sm">
          <p className="text-xs text-gray-400">
            {count.toLocaleString('fa-IR')} رکورد · صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loadingTable}
              className="btn-secondary px-3 py-1.5 disabled:opacity-40"
            >قبلی</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loadingTable}
              className="btn-secondary px-3 py-1.5 disabled:opacity-40"
            >بعدی</button>
          </div>
        </div>
      </div>

      <ExportCenterModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}


function DailyChart({ data }: { data: { date: string; total: number; failed: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.total));
  const CHART_HEIGHT = 160; // px — matches h-40

  return (
    <div className="flex items-end gap-1.5" dir="ltr" style={{ height: CHART_HEIGHT }}>
      {data.map(d => {
        const successCount = d.total - d.failed;
        const barPx   = Math.max(d.total > 0 ? 6 : 0, Math.round((d.total / max) * (CHART_HEIGHT - 24)));
        const failPx  = d.total > 0 ? Math.round((d.failed / d.total) * barPx) : 0;
        const succPx  = barPx - failPx;
        const label   = new Date(d.date).toLocaleDateString('fa-IR', { month: 'numeric', day: 'numeric' });
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center justify-end group"
            style={{ height: CHART_HEIGHT }}
            title={`${label} — ${formatNumber(d.total)} فعالیت · ${formatNumber(successCount)} موفق · ${formatNumber(d.failed)} ناموفق`}
          >
<span className="text-[10px] text-gray-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity leading-none">
              {d.total > 0 ? formatNumber(d.total) : ''}
            </span>
{d.total > 0 ? (
              <div className="w-full flex flex-col justify-end rounded-t-md overflow-hidden" style={{ height: barPx }}>
                {succPx > 0 && (
                  <div className="w-full bg-indigo-500" style={{ height: succPx }} />
                )}
                {failPx > 0 && (
                  <div className="w-full bg-red-400" style={{ height: failPx }} />
                )}
              </div>
            ) : (
              
              <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: 4 }} />
            )}
<span className="text-[9px] text-gray-300 mt-1 truncate w-full text-center leading-none">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ActionBreakdown({ data }: { data: { action: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.action} className="flex items-center gap-3">
          <span className="text-xs text-slate-600 w-32 truncate text-left flex-shrink-0">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="text-xs font-medium text-slate-500 w-10 text-left flex-shrink-0">{d.count.toLocaleString('fa-IR')}</span>
        </div>
      ))}
    </div>
  );
}


function ExportCenterModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState<'csv' | 'excel' | 'pdf' | null>(null);

  useEffect(() => {
    if (!open) setBusy(null);
  }, [open]);

  
  const getLast30Days = () => {
    const today = new Date();
    const from  = new Date(today);
    from.setDate(from.getDate() - 30);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return { dateFrom: fmt(from), dateTo: fmt(today) };
  };

  const handleExport = async (fmt: 'csv' | 'excel' | 'pdf') => {
    setBusy(fmt);
    const { dateFrom, dateTo } = getLast30Days();


    let downloadStarted = false;
    try {
      const r = await activityApi.export(fmt, dateFrom, dateTo);
      const blob = r.data as Blob;


      if (blob.size === 0) {
        throw new Error('فایل خروجی خالی دریافت شد. لطفاً دوباره تلاش کنید.');
      }
      if (blob.type && blob.type.includes('text/html')) {
        throw new Error('سرور در دسترس نیست. لطفاً دوباره تلاش کنید.');
      }
      const ext = fmt === 'csv' ? 'csv' : fmt === 'excel' ? 'xlsx' : 'pdf';
      downloadBlob(blob, `activity_logs_${dateFrom}_${dateTo}.${ext}`);
      downloadStarted = true;
      toast.success('فایل خروجی دانلود شد');
    } catch (err) {
      if (!downloadStarted) {
        toast.error(await getBlobErrorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  };

  const { dateFrom, dateTo } = getLast30Days();

  const formats: { id: 'csv' | 'excel' | 'pdf'; label: string; hint: string; color: string }[] = [
    { id: 'excel', label: 'Excel', hint: 'کامل، با قالب‌بندی',         color: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50' },
    { id: 'csv',   label: 'CSV',   hint: 'کامل، سازگار با Excel',       color: 'text-sky-600 border-sky-200 hover:bg-sky-50' },
    { id: 'pdf',   label: 'PDF',   hint: 'گزارش خلاصه (حداکثر ۱۵۰۰ ردیف)', color: 'text-red-600 border-red-200 hover:bg-red-50' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="مرکز خروجی گزارش فعالیت‌ها" size="sm">
      <div className="p-4 sm:p-6 space-y-5">
<div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-xs font-medium text-slate-700">بازه خروجی: ۳۰ روز اخیر</p>
            <p className="text-[11px] text-gray-400 mt-0.5" dir="ltr">{dateFrom} → {dateTo}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {formats.map(f => (
            <button
              key={f.id}
              onClick={() => handleExport(f.id)}
              disabled={busy !== null}
              className={`flex flex-col items-center justify-center gap-1.5 py-5 rounded-xl border-2 bg-white transition-all disabled:opacity-50 ${f.color}`}
            >
              {busy === f.id
                ? <Spinner size="sm" />
                : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>}
              <span className="text-sm font-bold">{f.label}</span>
              <span className="text-[11px] text-gray-400 text-center leading-tight">{f.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
