import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { adminSurveyApi } from '../../../api/endpoints';
import type {
  AuditPagination,
  IPAuditAnswer,
  IPAuditData,
  IPAuditIPOption,
} from '../../../types';
import { SearchInput } from '../../../components/common';
import { downloadBlob, getBlobErrorMessage } from '../../../utils/helpers';
import { isCanceledRequest } from '../../../utils/http';
import { ScorePill, fa } from './surveyResultsPrimitives';

const IP_PAGE_SIZE = 6;
const DEFAULT_PEOPLE_PAGE_SIZE = 1;
const PEOPLE_PAGE_SIZE_OPTIONS = [1, 2, 5] as const;
const TYPE_LABELS: Record<string, string> = {
  numeric: 'عددی',
  emoji: 'ایموجی',
  text: 'متنی',
};
const EMOJI_TONES: Record<string, string> = {
  bad: 'text-red-600 bg-red-50 border-red-100 dark:text-red-400 dark:bg-red-950/25 dark:border-red-900/60',
  average: 'text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-950/25 dark:border-amber-900/60',
  good: 'text-lime-700 bg-lime-50 border-lime-100 dark:text-lime-400 dark:bg-lime-950/25 dark:border-lime-900/60',
  excellent: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/25 dark:border-emerald-900/60',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function answerTypeLabel(type: string) {
  return type.split('+').map(item => TYPE_LABELS[item] || item).join(' + ');
}

function RatingFaceIcon({ value }: { value: IPAuditAnswer['emoji_rating'] }) {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16" />
      {value === 'excellent' ? (
        <>
          <path d="M7.7 9.6c.5-.5 1-.7 1.6-.7s1.1.2 1.6.7M13.1 9.6c.5-.5 1-.7 1.6-.7s1.1.2 1.6.7" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M7.8 13.6c1.1 1.5 2.5 2.3 4.2 2.3s3.1-.8 4.2-2.3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="8.6" cy="10" r="1.15" fill="currentColor" />
          <circle cx="15.4" cy="10" r="1.15" fill="currentColor" />
          {value === 'bad' && (
            <path d="M8.3 15.5c1-1.2 2.2-1.8 3.7-1.8s2.7.6 3.7 1.8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          )}
          {value === 'average' && (
            <path d="M8.3 14.8h7.4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          )}
          {value === 'good' && (
            <path d="M8.3 14c1 1 2.2 1.5 3.7 1.5s2.7-.5 3.7-1.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          )}
          {!value && (
            <path d="M8.3 14.8h7.4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
          )}
        </>
      )}
    </svg>
  );
}

function PaginationControls({
  pagination,
  onPageChange,
  label,
  busy = false,
  showPageNumbers = false,
}: {
  pagination: AuditPagination;
  onPageChange: (page: number) => void;
  label: string;
  busy?: boolean;
  showPageNumbers?: boolean;
}) {
  if (pagination.total_pages <= 1) return null;
  const nearbyPages = Array.from(new Set([
    1,
    pagination.page - 1,
    pagination.page,
    pagination.page + 1,
    pagination.total_pages,
  ]))
    .filter(page => page >= 1 && page <= pagination.total_pages)
    .sort((a, b) => a - b);

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={!pagination.has_previous || busy}
        onClick={() => onPageChange(pagination.page - 1)}
        className="btn-secondary min-h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        قبلی
      </button>
      {showPageNumbers ? (
        <div className="flex min-w-0 items-center justify-center gap-1" aria-live="polite">
          {nearbyPages.map((page, index) => (
            <span key={page} className="contents">
              {index > 0 && page - nearbyPages[index - 1] > 1 && (
                <span className="px-0.5 text-xs text-slate-400" aria-hidden="true">…</span>
              )}
              <button
                type="button"
                disabled={busy}
                aria-current={page === pagination.page ? 'page' : undefined}
                aria-label={`صفحه ${fa(page)}`}
                onClick={() => onPageChange(page)}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors disabled:opacity-40 ${
                  page === pagination.page
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {fa(page)}
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          صفحه {fa(pagination.page)} از {fa(pagination.total_pages)}
        </span>
      )}
      <button
        type="button"
        disabled={!pagination.has_next || busy}
        onClick={() => onPageChange(pagination.page + 1)}
        className="btn-secondary min-h-9 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        بعدی
      </button>
    </nav>
  );
}

function PeoplePaginationToolbar({
  pagination,
  pageSize,
  busy,
  onPageChange,
  onPageSizeChange,
}: {
  pagination: AuditPagination;
  pageSize: number;
  busy: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const firstPerson = pagination.total
    ? (pagination.page - 1) * pagination.page_size + 1
    : 0;
  const lastPerson = Math.min(
    pagination.page * pagination.page_size,
    pagination.total,
  );

  return (
    <div className="card p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            افراد {fa(firstPerson)} تا {fa(lastPerson)}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            از مجموع {fa(pagination.total)} فرد مرتبط با این IP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">تعداد در صفحه:</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
            {PEOPLE_PAGE_SIZE_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                disabled={busy}
                onClick={() => onPageSizeChange(option)}
                aria-pressed={pageSize === option}
                className={`flex h-7 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                  pageSize === option
                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                {fa(option)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <PaginationControls
        pagination={pagination}
        onPageChange={onPageChange}
        label="صفحه‌بندی افراد ارزیابی‌شده"
        busy={busy}
        showPageNumbers
      />
    </div>
  );
}

function AnswerValue({ answer }: { answer: IPAuditAnswer }) {
  const answerTypes = answer.question_type.split('+');
  const supportsScore = answerTypes.includes('numeric');
  const supportsEmoji = answerTypes.includes('emoji');
  const supportsComment = answerTypes.includes('text');
  const emptyLabel = (supported: boolean) => supported ? 'ثبت نشده' : 'برای این سوال تعریف نشده';

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-2 gap-2.5">
        <section
          aria-label="امتیاز عددی از یک تا ده"
          className={`flex min-h-20 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
            supportsScore
              ? 'border-indigo-100 bg-indigo-50/55 dark:border-indigo-900/70 dark:bg-indigo-950/25'
              : 'border-slate-200 bg-slate-50/60 opacity-65 dark:border-slate-800 dark:bg-slate-900/40'
          }`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">امتیاز ۱ تا ۱۰</p>
            {answer.numeric_score == null && (
              <p className="mt-1 text-[10px] leading-4 text-slate-400">{emptyLabel(supportsScore)}</p>
            )}
          </div>
          {answer.numeric_score != null && (
            <div className="flex shrink-0 items-end gap-1">
              <ScorePill value={answer.numeric_score} size="md" />
              <span className="pb-0.5 text-[10px] text-slate-400">از ۱۰</span>
            </div>
          )}
        </section>

        <section
          aria-label="امتیاز ایموجی"
          className={`flex min-h-20 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
            answer.emoji_rating
              ? EMOJI_TONES[answer.emoji_rating]
              : supportsEmoji
                ? 'border-amber-100 bg-amber-50/55 text-amber-600 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-400'
                : 'border-slate-200 bg-slate-50/60 text-slate-400 opacity-65 dark:border-slate-800 dark:bg-slate-900/40'
          }`}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">امتیاز ایموجی</p>
            <p className={`mt-1 text-xs font-bold ${answer.emoji_rating ? 'text-current' : 'text-slate-400'}`}>
              {answer.emoji_rating
                ? answer.emoji_label || answer.emoji_rating
                : emptyLabel(supportsEmoji)}
            </p>
          </div>
          <span className="shrink-0">
            <RatingFaceIcon value={answer.emoji_rating} />
          </span>
        </section>
      </div>

      <section
        aria-label="نظر متنی"
        className={`mt-2.5 min-w-0 rounded-xl border p-3 ${
          supportsComment
            ? 'border-slate-200 bg-slate-50/70 dark:border-slate-700 dark:bg-slate-900/45'
            : 'border-slate-200 bg-slate-50/50 opacity-65 dark:border-slate-800 dark:bg-slate-900/30'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75h6.75m-6.75 3h4.5M21 12c0 4.556-4.03 8.25-9 8.25a10.1 10.1 0 0 1-4.035-.824L3 20.25l1.228-3.276A7.7 7.7 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
          </span>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">نظر و توضیحات</p>
        </div>
        {answer.free_text_answer ? (
          <blockquote
            tabIndex={0}
            aria-label={`متن پاسخ به ${answer.question_text}`}
            className="mt-2 max-h-36 overflow-y-auto overflow-x-hidden overscroll-contain rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 shadow-sm outline-none [scrollbar-gutter:stable] focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/55 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-950"
          >
            <p className="whitespace-pre-wrap break-words">{answer.free_text_answer}</p>
          </blockquote>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-[11px] text-slate-400 dark:border-slate-700">
            {emptyLabel(supportsComment)}
          </p>
        )}
      </section>
    </div>
  );
}

function IPListSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-label="در حال بارگذاری آدرس‌های IP" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
          <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          <div className="mt-2 h-2.5 w-24 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="space-y-4" aria-label="در حال بارگذاری پاسخ‌ها" aria-busy="true">
      <div className="card h-32 animate-pulse bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
      <div className="card space-y-3 p-4">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
        <div className="h-9 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800" />
      </div>
      <div className="card overflow-hidden">
        <div className="h-16 animate-pulse border-b border-slate-100 bg-slate-50 motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-800" />
        <div className="space-y-3 p-4">
          <div className="h-16 animate-pulse rounded-xl bg-slate-50 motion-reduce:animate-none dark:bg-slate-800" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-50 motion-reduce:animate-none dark:bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export function IPResponseAudit({ surveyId }: { surveyId: number }) {
  const [ipOptions, setIPOptions] = useState<IPAuditIPOption[]>([]);
  const [ipPagination, setIPPagination] = useState<AuditPagination | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [ipPage, setIPPage] = useState(1);
  const [selectedIP, setSelectedIP] = useState('');
  const [peoplePage, setPeoplePage] = useState(1);
  const [peoplePageSize, setPeoplePageSize] = useState(DEFAULT_PEOPLE_PAGE_SIZE);
  const [data, setData] = useState<IPAuditData | null>(null);
  const [loadingIPs, setLoadingIPs] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [ipError, setIPError] = useState(false);
  const [auditError, setAuditError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reloadIPs, setReloadIPs] = useState(0);
  const [reloadAudit, setReloadAudit] = useState(0);
  const recordNextAuditView = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingIPs(true);
    setIPError(false);
    adminSurveyApi.ipAuditIPs(
      surveyId,
      { search: debouncedSearch, page: ipPage, page_size: IP_PAGE_SIZE },
      controller.signal,
    )
      .then(response => {
        setIPOptions(Array.isArray(response.data.ips) ? response.data.ips : []);
        setIPPagination(response.data.pagination);
      })
      .catch(error => {
        if (isCanceledRequest(error, controller.signal)) return;
        setIPError(true);
        toast.error('خطا در بارگذاری فهرست IPها');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingIPs(false);
      });
    return () => controller.abort();
  }, [surveyId, debouncedSearch, ipPage, reloadIPs]);

  useEffect(() => {
    if (!selectedIP) {
      setData(null);
      setAuditError(false);
      return;
    }
    const controller = new AbortController();
    const recordActivity = recordNextAuditView.current;
    recordNextAuditView.current = false;
    setLoadingAudit(true);
    setAuditError(false);
    setData(null);
    adminSurveyApi.ipAudit(
      surveyId,
      selectedIP,
      peoplePage,
      peoplePageSize,
      recordActivity,
      controller.signal,
    )
      .then(response => setData(response.data))
      .catch(error => {
        if (isCanceledRequest(error, controller.signal)) return;
        setAuditError(true);
        toast.error('خطا در بارگذاری ممیزی پاسخ‌ها');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingAudit(false);
      });
    return () => controller.abort();
  }, [surveyId, selectedIP, peoplePage, peoplePageSize, reloadAudit]);

  const selectIP = (ip: string) => {
    recordNextAuditView.current = true;
    setSelectedIP(ip);
    setPeoplePage(1);
  };

  const clearSelectedIP = () => {
    recordNextAuditView.current = false;
    setSelectedIP('');
    setData(null);
    setPeoplePage(1);
    setAuditError(false);
  };

  const changePeoplePage = (page: number) => {
    setPeoplePage(page);
    window.requestAnimationFrame(() => {
      document.getElementById('ip-audit-results')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const changePeoplePageSize = (pageSize: number) => {
    setPeoplePageSize(pageSize);
    setPeoplePage(1);
    window.requestAnimationFrame(() => {
      document.getElementById('ip-audit-results')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const exportExcel = async () => {
    if (!selectedIP || exporting) return;
    setExporting(true);
    try {
      const response = await adminSurveyApi.exportIPAuditExcel(surveyId, selectedIP);
      const blob = response.data as Blob;
      if (!blob.size) throw new Error('فایل خروجی خالی دریافت شد.');
      downloadBlob(blob, `ip_audit_${surveyId}_${selectedIP.replace(/:/g, '-')}.xlsx`);
      toast.success('خروجی Excel ممیزی IP دانلود شد');
    } catch (error) {
      toast.error(await getBlobErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section aria-labelledby="ip-audit-title" className="space-y-5">
      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="ip-audit-title" className="text-base font-bold text-slate-800 dark:text-slate-100">
                ممیزی پاسخ‌های IP
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                هر فرد، ارسال و پاسخ به‌صورت مستقل نمایش داده می‌شود.
              </p>
            </div>
            <button
              type="button"
              onClick={exportExcel}
              disabled={!selectedIP || exporting}
              className="btn-primary inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                </svg>
              )}
              خروجی Excel برای IP انتخاب‌شده
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs text-slate-500 dark:text-slate-400 sm:px-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            فقط پاسخ‌های همین نظرسنجی
          </span>
          <span>گروه‌بندی امن بر اساس فرد ارزیابی‌شده</span>
          <span>خروجی کامل، مستقل از صفحه جاری</span>
        </div>
      </div>

      <div className="grid items-start gap-5 min-[900px]:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="card overflow-hidden min-[900px]:sticky min-[900px]:top-4" aria-label="انتخاب آدرس IP">
          <div className="border-b border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
              <label htmlFor="ip-audit-search" className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                آدرس IP
              </label>
              {selectedIP && (
                <button
                  type="button"
                  onClick={clearSelectedIP}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:focus:ring-rose-900"
                  aria-label={`لغو انتخاب IP ${selectedIP}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  لغو انتخاب
                </button>
              )}
            </div>
            <SearchInput
                id="ip-audit-search"
                value={search}
                onChange={value => {
                  setSearch(value);
                  setIPPage(1);
                }}
                placeholder="جستجو بر اساس آدرس IP..."
                ariaLabel="جستجو در آدرس‌های IP"
              />
          </div>

          <div className="max-h-80 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] sm:max-h-96 min-[900px]:max-h-[31rem]">
            {loadingIPs ? (
              <IPListSkeleton />
            ) : ipError ? (
              <div className="p-6 text-center">
                <p className="text-sm text-rose-600 dark:text-rose-400">فهرست IPها بارگذاری نشد.</p>
                <button type="button" onClick={() => setReloadIPs(value => value + 1)}
                  className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  تلاش دوباره
                </button>
              </div>
            ) : ipOptions.length ? (
              <div role="listbox" aria-label="آدرس‌های IP دارای پاسخ" className="space-y-1.5 p-2">
                {ipOptions.map(option => {
                  const active = selectedIP === option.ip_address;
                  return (
                    <button
                      key={option.ip_address}
                      type="button"
                      role="option"
                      aria-selected={active}
                      aria-label={active
                        ? `لغو انتخاب IP ${option.ip_address}`
                        : `انتخاب IP ${option.ip_address}`}
                      onClick={() => active ? clearSelectedIP() : selectIP(option.ip_address)}
                      className={`w-full rounded-xl border p-3 text-right transition-all focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                        active
                          ? 'border-indigo-300 bg-indigo-50 shadow-sm dark:border-indigo-700 dark:bg-indigo-950/40'
                          : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <span className={`block break-all font-mono text-sm font-semibold ${
                        active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'
                      }`} dir="ltr">
                        {option.ip_address}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                          {fa(option.response_count)} پاسخ
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                          {fa(option.surveyed_person_count)} فرد
                        </span>
                        <span className="mr-auto">{formatDate(option.latest_submission_at)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-sm text-slate-400">
                  {debouncedSearch
                    ? 'IP مطابق جستجو یافت نشد.'
                    : 'برای این نظرسنجی پاسخی دارای IP ثبت نشده است.'}
                </p>
              </div>
            )}
          </div>

          {ipPagination && (
            <div className="border-t border-slate-200 p-3 dark:border-slate-700">
              <p className="mb-2 text-center text-[11px] text-slate-400">
                {fa(ipPagination.total)} آدرس IP
              </p>
              <PaginationControls
                pagination={ipPagination}
                onPageChange={setIPPage}
                label="صفحه‌بندی فهرست IPها"
                busy={loadingIPs}
              />
            </div>
          )}
        </aside>

        <div id="ip-audit-results" className="min-w-0 scroll-mt-4">
          {!selectedIP && (
            <div className="card flex min-h-72 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 dark:bg-indigo-950/50 dark:text-indigo-300">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9Z" />
                </svg>
              </div>
              <h3 className="mt-4 font-bold text-slate-700 dark:text-slate-100">یک IP را انتخاب کنید</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                پاسخ‌ها، ارسال‌ها و افراد مرتبط با IP انتخاب‌شده اینجا با تفکیک کامل نمایش داده می‌شوند.
              </p>
            </div>
          )}

          {selectedIP && loadingAudit && <AuditSkeleton />}
          {selectedIP && auditError && !loadingAudit && (
            <div className="card p-10 text-center">
              <p className="text-sm text-rose-600 dark:text-rose-400">بارگذاری ممیزی پاسخ‌ها ناموفق بود.</p>
              <button type="button" onClick={() => setReloadAudit(value => value + 1)}
                className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                تلاش دوباره
              </button>
            </div>
          )}

          {data && !loadingAudit && !auditError && (
            <div className="space-y-4">
              <div className="card overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-400">IP انتخاب‌شده</p>
                    <p dir="ltr" className="mt-1 break-all text-left font-mono text-lg font-bold text-indigo-700 dark:text-indigo-300">
                      {data.selected_ip_address}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <p className="text-xs text-slate-400">
                      آخرین ارسال: <span className="text-slate-600 dark:text-slate-300">{formatDate(data.summary.latest_submission_at)}</span>
                    </p>
                    <button
                      type="button"
                      onClick={clearSelectedIP}
                      className="btn-secondary min-h-8 px-2.5 text-xs"
                    >
                      لغو انتخاب IP
                    </button>
                  </div>
                </div>
                <dl className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 dark:divide-slate-700">
                  {[
                    ['پاسخ', data.summary.total_answers],
                    ['ارسال مرتبط', data.summary.total_linked_submissions],
                    ['فرد ارزیابی‌شده', data.summary.total_surveyed_people],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0 p-3 text-center sm:p-4">
                      <dd className="text-lg font-bold text-slate-800 dark:text-slate-100">{fa(Number(value))}</dd>
                      <dt className="mt-1 text-[11px] text-slate-400 sm:text-xs">{label}</dt>
                    </div>
                  ))}
                </dl>
              </div>

              {data.people.length > 0 && (
                <PeoplePaginationToolbar
                  pagination={data.pagination}
                  pageSize={peoplePageSize}
                  busy={loadingAudit}
                  onPageChange={changePeoplePage}
                  onPageSizeChange={changePeoplePageSize}
                />
              )}

              {data.people.length === 0 ? (
                <div className="card p-10 text-center text-sm text-slate-400">
                  برای این IP پاسخی در نظرسنجی جاری یافت نشد.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.people.map((person, personIndex) => (
                    <article key={person.surveyed_person_id} className="card overflow-hidden">
                      <header className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {fa((data.pagination.page - 1) * data.pagination.page_size + personIndex + 1)}
                        </span>
                        <div className="min-w-0">
                          <h3 className="break-words font-bold text-slate-800 dark:text-slate-100">
                            {person.surveyed_person_name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {[person.role_title, person.department].filter(Boolean).join(' · ') || 'بدون اطلاعات سازمانی'}
                            <span className="mx-1.5">·</span>
                            {fa(person.submissions.length)} ارسال در این صفحه
                          </p>
                        </div>
                      </header>

                      <div className="space-y-5 p-3 sm:p-4">
                        {person.submissions.map((submission, submissionIndex) => (
                          <section
                            key={submission.submission_identifier}
                            aria-label={`ارسال ${submission.submission_identifier}`}
                            className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
                          >
                            <div className="flex flex-col gap-1 border-b border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                  ارسال {fa(submissionIndex + 1)}
                                </span>
                                <code dir="ltr" className="truncate text-left text-[11px] text-slate-400" title={submission.submission_identifier}>
                                  {submission.submission_identifier}
                                </code>
                              </div>
                              <time className="shrink-0 text-[11px] text-slate-400" dateTime={submission.submitted_at}>
                                {formatDate(submission.submitted_at)}
                              </time>
                            </div>

                            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                              {submission.answers.map((answer, answerIndex) => (
                                <div
                                  key={`${submission.submission_identifier}-${answer.question_id}`}
                                  className="min-w-0 p-3 sm:p-4"
                                >
                                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <dt className="break-words text-sm font-medium leading-6 text-slate-700 dark:text-slate-100">
                                      <span className="ml-1.5 text-xs text-slate-400">{fa(answerIndex + 1)}.</span>
                                      {answer.question_text}
                                    </dt>
                                    <span className="inline-flex shrink-0 self-start rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                      {answerTypeLabel(answer.question_type)}
                                    </span>
                                  </div>
                                  <dd className="mt-3 min-w-0">
                                    <AnswerValue answer={answer} />
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </section>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {data.people.length > 0 && data.pagination.total_pages > 1 && (
                <PeoplePaginationToolbar
                  pagination={data.pagination}
                  pageSize={peoplePageSize}
                  busy={loadingAudit}
                  onPageChange={changePeoplePage}
                  onPageSizeChange={changePeoplePageSize}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
