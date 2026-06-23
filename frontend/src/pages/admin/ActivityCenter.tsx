import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { activityApi } from '../../api/endpoints';
import {
  EmptyState, Modal, PageHeader, SearchInput, Spinner,
} from '../../components/common';
import {
  ActivityCharts, ActivityCriticalPanel, ActivityFilterOptions,
  ActivityLog, ActivityLogFilters, ActivityStats,
} from '../../types';
import { downloadBlob, formatDateTime, getBlobErrorMessage, getErrorMessage } from '../../utils/helpers';

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
  if (action.startsWith('question')) return 'bg-violet-500';
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

  const [exportOpen, setExportOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const loadTop = useCallback(async () => {
    setLoadingTop(true);
    try {
      const [s, c, cr, tl, opt] = await Promise.all([
        activityApi.stats(),
        activityApi.charts(14),
        activityApi.critical(8),
        activityApi.timeline(12),
        activityApi.filterOptions(),
      ]);
      setStats(s.data);
      setCharts(c.data);
      setCritical(cr.data);
      setTimeline(tl.data);
      setOptions(opt.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingTop(false);
    }
  }, []);

  const loadTable = useCallback(async () => {
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
      const res = await activityApi.logs(params);
      setLogs(res.data.results);
      setCount(res.data.count);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingTable(false);
    }
  }, [page, search, action, statusFilter, actor, criticalOnly]);

  useEffect(() => { loadTop(); }, [loadTop]);
  useEffect(() => { loadTable(); }, [loadTable]);


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

      {}
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
        {}
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
            <div className="flex justify-center py-12"><Spinner /></div>
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

        {}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <h2 className="text-sm font-bold text-slate-800">اقدامات حساس</h2>
            {critical && <span className="text-xs text-gray-400">({critical.count.toLocaleString('fa-IR')})</span>}
          </div>
          {loadingTop ? (
            <div className="flex justify-center py-12"><Spinner /></div>
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

      {}
      <div className="card p-4 sm:p-5 mb-5">
        <h2 className="text-sm font-bold text-slate-800 mb-4">جدول زمانی فعالیت‌ها</h2>
        {loadingTop ? (
          <div className="flex justify-center py-8"><Spinner /></div>
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

      {}
      <div className="card p-4 sm:p-5">
        <h2 className="text-sm font-bold text-slate-800 mb-4">گزارش کامل فعالیت‌ها</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="lg:col-span-2">
            <SearchInput value={search} onChange={handleSearch} placeholder="جستجو در شرح، کاربر یا IP..." />
          </div>
          <select className="input-field w-full" value={action} onChange={e => onFilterChange(() => setAction(e.target.value))}>
            <option value="">همه فعالیت‌ها</option>
            {options?.actions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <select className="input-field w-full" value={actor} onChange={e => onFilterChange(() => setActor(e.target.value))}>
            <option value="">همه کاربران</option>
            {options?.actors.map(a => <option key={a.id} value={String(a.id)}>{a.full_name || a.username}</option>)}
          </select>
          <select className="input-field w-full" value={statusFilter} onChange={e => onFilterChange(() => setStatusFilter(e.target.value))}>
            <option value="">همه وضعیت‌ها</option>
            {options?.statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none px-1">
            <input type="checkbox" checked={criticalOnly} onChange={e => onFilterChange(() => setCriticalOnly(e.target.checked))} className="w-4 h-4 rounded accent-red-500" />
            فقط اقدامات حساس
          </label>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingTable ? (
                <tr><td colSpan={6} className="py-10 text-center"><Spinner /></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="py-10">
                  <EmptyState title="فعالیتی یافت نشد" description="با فیلترهای انتخابی هیچ گزارشی موجود نیست." />
                </td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className={log.is_critical ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {}
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
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map(d => {
        const h = Math.round((d.total / max) * 100);
        const failedH = d.total > 0 ? Math.round((d.failed / d.total) * h) : 0;
        const label = new Date(d.date).toLocaleDateString('fa-IR', { month: 'numeric', day: 'numeric' });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center justify-end group" title={`${label} — ${d.total} فعالیت (${d.failed} ناموفق)`}>
            <span className="text-[10px] text-gray-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{d.total}</span>
            <div className="w-full rounded-t-md bg-indigo-100 relative overflow-hidden" style={{ height: `${Math.max(4, h)}%` }}>
              <div className="absolute inset-x-0 top-0 bg-indigo-500" style={{ height: `${100 - (failedH / Math.max(1, h)) * 100}%` }} />
              {failedH > 0 && <div className="absolute inset-x-0 bottom-0 bg-red-400" style={{ height: `${(failedH / Math.max(1, h)) * 100}%` }} />}
            </div>
            <span className="text-[9px] text-gray-300 mt-1 truncate w-full text-center">{label}</span>
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
        {}
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
