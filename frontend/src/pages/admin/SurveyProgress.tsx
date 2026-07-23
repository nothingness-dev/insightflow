import { useCallback, useEffect, useMemo, useState } from 'react';
import { dashboardApi } from '../../api/endpoints';
import { SurveyProgress, SurveyProgressDashboard } from '../../types';
import { EmptyState, PageHeader, ProgressListSkeleton, StatusBadge } from '../../components/common/index';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import { useTheme } from '../../contexts/ThemeContext';

const numberFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatLastResponse(value: string | null) {
  return value ? formatDateTime(value) : 'هنوز پاسخی ثبت نشده';
}

function progressTone(percentage: number) {
  if (percentage <= 40) {
    return {
      bar: 'bg-red-500',
      text: 'text-red-700',
    };
  }

  if (percentage <= 80) {
    return {
      bar: 'bg-amber-400',
      text: 'text-amber-700',
    };
  }

  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
  };
}

function ProgressBar({
  percentage,
  completed,
  assigned,
  label = 'درصد تکمیل نظرسنجی توسط کارکنان',
}: {
  percentage: number;
  completed?: number;
  assigned?: number;
  label?: string;
}) {
  const tone = progressTone(percentage);
  const valueText = completed != null && assigned != null
    ? `${formatNumber(completed)} از ${formatNumber(assigned)} کارمند تکمیل کرده‌اند؛ ${formatNumber(percentage)} درصد`
    : `${formatNumber(percentage)} درصد`;

  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      aria-valuetext={valueText}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
        style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  darkAccent,
  iconColor = '#334155',
  darkIconColor = '#cbd5e1',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  darkAccent?: string;
  iconColor?: string;
  darkIconColor?: string;
}) {
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  return (
    <div className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: isDark ? (darkAccent || accent) : accent }}
      >
        <span style={{ color: isDark ? darkIconColor : iconColor }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function CompletionChart({ surveys }: { surveys: SurveyProgress[] }) {
  const chartSurveys = surveys.filter((survey) => survey.tracking_enabled);

  return (
    <section className="card p-5">
      <div className="mb-5">
        <h2 className="section-title">مقایسه تکمیل توسط کارکنان</h2>
        <p className="text-xs text-gray-400 mt-1">
          درصد تکمیل براساس کارکنانی که به همه سوال‌های فعال، برای همه افراد فعال، پاسخ داده‌اند.
        </p>
      </div>

      {chartSurveys.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          هنوز نظرسنجی منتشرشده یا بسته‌شده‌ای برای نمایش نمودار وجود ندارد.
        </div>
      ) : (
        <div className="space-y-4">
          {chartSurveys.map((survey) => {
            const tone = progressTone(survey.completion_percentage);

            return (
              <div key={survey.survey_id}>
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <span className="text-sm font-medium text-slate-700 truncate" title={survey.title}>
                    {survey.title}
                  </span>
                  <span className={`text-xs font-bold flex-shrink-0 ${tone.text}`}>
                    {formatNumber(survey.completed_employees)} از {formatNumber(survey.assigned_employees)} کارمند · {formatNumber(survey.completion_percentage)}٪
                  </span>
                </div>
                <ProgressBar
                  percentage={survey.completion_percentage}
                  completed={survey.completed_employees}
                  assigned={survey.assigned_employees}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const PENDING_PAGE_SIZE = 10;

function PendingUsersList({ users }: { users: SurveyProgress['pending_users'] }) {
  const [page, setPage] = useState(0);

  if (users.length === 0) {
    return (
      <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        همه کارکنان فعال این نظرسنجی را تکمیل کرده‌اند.
      </div>
    );
  }

  const totalPages = Math.ceil(users.length / PENDING_PAGE_SIZE);
  const pageUsers = users.slice(page * PENDING_PAGE_SIZE, (page + 1) * PENDING_PAGE_SIZE);

  return (
    <div>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
        {pageUsers.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 bg-white px-4 py-3.5">
            <span className="text-sm font-medium text-slate-700 truncate">{user.full_name}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">@{user.username}</span>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-400">
            {formatNumber(page * PENDING_PAGE_SIZE + 1)}–{formatNumber(Math.min((page + 1) * PENDING_PAGE_SIZE, users.length))} از {formatNumber(users.length)} نفر
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded-lg border border-gray-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              قبلی
            </button>
            <span className="px-3 py-1 text-xs text-gray-500">
              {formatNumber(page + 1)} / {formatNumber(totalPages)}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 text-xs rounded-lg border border-gray-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SurveyProgressCard({ survey }: { survey: SurveyProgress }) {
  const [expanded, setExpanded] = useState(false);
  const tone = progressTone(survey.completion_percentage);

  const handleToggle = () => {
    setExpanded((current) => !current);
  };

  return (
    <article className="card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800 truncate" title={survey.title}>
                {survey.title}
              </h2>
              <StatusBadge status={survey.status} />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {formatNumber(survey.active_people_count)} نفر و {formatNumber(survey.active_questions_count)} سوال فعال در این نظرسنجی وجود دارد.
            </p>
          </div>

          {survey.tracking_enabled && survey.pending_employees > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="btn-secondary self-start !border-amber-200 !bg-amber-50 !px-3 text-xs !text-amber-800 hover:!bg-amber-100 dark:!border-amber-800 dark:!bg-amber-950/30 dark:!text-amber-200 dark:hover:!bg-amber-950/50"
            >
              مشاهده {formatNumber(survey.pending_employees)} کارمند در انتظار
            </button>
          ) : survey.tracking_enabled ? (
            <span className="inline-flex min-h-11 self-start items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
              همه کارکنان تکمیل کرده‌اند
            </span>
          ) : (
            <span className="inline-flex self-start items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
              تا انتشار غیرفعال
            </span>
          )}
        </div>

        {survey.tracking_enabled ? (
          <>
            <section className="mt-6 rounded-xl border border-gray-100 bg-gray-50/60 p-4" aria-labelledby={`employee-progress-${survey.survey_id}`}>
              <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between gap-3">
                <div>
                  <h3 id={`employee-progress-${survey.survey_id}`} className="text-sm font-semibold text-slate-700">مشارکت کارکنان</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatNumber(survey.completed_employees)} از {formatNumber(survey.assigned_employees)} کارمند، نظرسنجی را کامل کرده‌اند.
                  </p>
                </div>
                <p className={`text-3xl font-bold ${tone.text}`}>
                  {formatNumber(survey.completion_percentage)}٪
                </p>
              </div>

              <div className="mt-3">
                <ProgressBar
                  percentage={survey.completion_percentage}
                  completed={survey.completed_employees}
                  assigned={survey.assigned_employees}
                />
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                تکمیل یعنی کارمند به تمام سوال‌های فعال برای تمام افراد فعال پاسخ داده است.
              </p>

              <dl className="mt-4 grid grid-cols-3 divide-x divide-x-reverse divide-gray-200 border-t border-gray-200 pt-4">
                <div className="text-center">
                  <dt className="text-xs text-gray-400">تخصیص‌یافته</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-700">{formatNumber(survey.assigned_employees)}</dd>
                </div>
                <div className="text-center">
                  <dt className="text-xs text-gray-400">تکمیل‌شده</dt>
                  <dd className="mt-1 text-lg font-bold text-emerald-600">{formatNumber(survey.completed_employees)}</dd>
                </div>
                <div className="text-center">
                  <dt className="text-xs text-gray-400">در انتظار</dt>
                  <dd className="mt-1 text-lg font-bold text-amber-600">{formatNumber(survey.pending_employees)}</dd>
                </div>
              </dl>
              <p className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-500">
                آخرین پاسخ کارکنان: <span className="font-medium text-slate-700">{formatLastResponse(survey.last_employee_response_at)}</span>
              </p>
            </section>

            <section className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/25" aria-labelledby={`anonymous-progress-${survey.survey_id}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id={`anonymous-progress-${survey.survey_id}`} className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">مشارکت ناشناس</h3>
                  <p className="mt-1 text-xs text-indigo-700/70 dark:text-indigo-300">این تعداد در نرخ تکمیل کارکنان محاسبه نمی‌شود.</p>
                </div>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-200">{formatNumber(survey.anonymous_participants)}</p>
              </div>
              <p className="mt-3 border-t border-indigo-100 pt-3 text-xs text-indigo-800/70 dark:border-indigo-900/60 dark:text-indigo-300">
                آخرین مشارکت ناشناس: <span className="font-medium text-indigo-900 dark:text-indigo-100">{formatLastResponse(survey.last_anonymous_response_at)}</span>
              </p>
            </section>

            <p className="mt-3 text-xs text-gray-400">
              آخرین پاسخ دریافت‌شده: <span className="font-medium text-gray-600">{formatLastResponse(survey.last_response_at)}</span>
            </p>
          </>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">
            {survey.active_people_count === 0
              ? 'برای محاسبه پیشرفت، حداقل یک فرد فعال به این نظرسنجی اضافه کنید.'
              : survey.active_questions_count === 0
                ? 'برای محاسبه پیشرفت، حداقل یک سوال فعال به این نظرسنجی اضافه کنید.'
                : 'پس از انتشار نظرسنجی، وضعیت مشارکت کارکنان در این بخش نمایش داده می‌شود.'}
          </div>
        )}
      </div>

      {survey.tracking_enabled && survey.pending_employees > 0 && (
        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={handleToggle}
            className="w-full px-5 py-4 flex items-center justify-between text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors"
            aria-expanded={expanded}
          >
            <span>
              {expanded ? 'پنهان کردن کارکنان در انتظار' : 'مشاهده کارکنان در انتظار'} ({formatNumber(survey.pending_employees)})
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </button>

          {expanded && (
            <div className="px-5 pb-5 pt-1">
              <PendingUsersList users={survey.pending_users} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function SurveyProgressPage() {
  const [data, setData] = useState<SurveyProgressDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProgress = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await dashboardApi.surveyProgress(signal);
      setData(response.data);
    } catch (err) {
      if (isCanceledRequest(err, signal)) return;
      setError(getErrorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadProgress(controller.signal);
    return () => controller.abort();
  }, [loadProgress]);

  const prioritizedSurveys = useMemo(() => {
    if (!data) return [];

    return [...data.surveys].sort((first, second) => {
      if (first.tracking_enabled !== second.tracking_enabled) {
        return first.tracking_enabled ? -1 : 1;
      }

      const firstNeedsAttention = first.pending_employees > 0;
      const secondNeedsAttention = second.pending_employees > 0;
      if (firstNeedsAttention !== secondNeedsAttention) {
        return firstNeedsAttention ? -1 : 1;
      }

      if (firstNeedsAttention && first.completion_percentage !== second.completion_percentage) {
        return first.completion_percentage - second.completion_percentage;
      }

      const firstResponseTime = first.last_response_at
        ? new Date(first.last_response_at).getTime()
        : 0;
      const secondResponseTime = second.last_response_at
        ? new Date(second.last_response_at).getTime()
        : 0;
      return firstResponseTime - secondResponseTime;
    });
  }, [data]);

  if (loading) return <ProgressListSkeleton />;

  return (
    <div className="responsive-page">
      <PageHeader
        title="پیشرفت نظرسنجی‌ها"
        subtitle="پیگیری میزان مشارکت کارکنان در هر نظرسنجی"
        action={
          <button type="button" onClick={() => void loadProgress()} className="btn-secondary">
            بروزرسانی
          </button>
        }
      />

      {error ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button type="button" onClick={() => void loadProgress()} className="btn-primary mt-4">
            تلاش دوباره
          </button>
        </div>
      ) : !data ? (
        <div className="card">
          <EmptyState title="داده‌ای برای نمایش وجود ندارد" description="دوباره تلاش کنید." />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 items-start xl:grid-cols-[2fr_1fr] gap-4 mb-6" aria-label="خلاصه مشارکت">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">مشارکت کارکنان</h2>
                  <p className="mt-1 text-xs text-gray-500">فقط پاسخ‌های کارکنان تخصیص‌یافته در نرخ تکمیل محاسبه می‌شوند.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
                  {formatNumber(data.summary.total_surveys)} نظرسنجی
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-3">
                <SummaryCard
                  label="پاسخ‌های تخصیص‌یافته"
                  value={formatNumber(data.summary.total_assigned_responses)}
                  accent="#eff6ff"
                  darkAccent="rgba(59,130,246,0.16)"
                  iconColor="#2563eb"
                  darkIconColor="#93c5fd"
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>}
                />
                <SummaryCard
                  label="تکمیل‌شده"
                  value={formatNumber(data.summary.total_completed_responses)}
                  accent="#ecfdf5"
                  darkAccent="rgba(16,185,129,0.16)"
                  iconColor="#059669"
                  darkIconColor="#6ee7b7"
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                />
                <SummaryCard
                  label="در انتظار"
                  value={formatNumber(data.summary.total_pending_responses)}
                  accent="#fffbeb"
                  darkAccent="rgba(245,158,11,0.16)"
                  iconColor="#d97706"
                  darkIconColor="#fcd34d"
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                />
                <SummaryCard
                  label="نرخ تکمیل کارکنان"
                  value={`${formatNumber(data.summary.overall_completion_percentage)}٪`}
                  accent="var(--c-50)"
                  darkAccent="var(--c-50)"
                  iconColor="var(--c-700)"
                  darkIconColor="var(--c-700)"
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-5 3 3 5-7" /></svg>}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5 dark:border-indigo-900/60 dark:bg-indigo-950/25">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">مشارکت ناشناس</h2>
                <p className="mt-1 text-xs text-indigo-800/70 dark:text-indigo-300">مستقل از نرخ تکمیل کارکنان نمایش داده می‌شود.</p>
              </div>
              <SummaryCard
                label="شرکت‌کنندگان ناشناس"
                value={formatNumber(data.summary.total_anonymous_participants)}
                accent="#eef2ff"
                darkAccent="rgba(99,102,241,0.16)"
                iconColor="#4f46e5"
                darkIconColor="#c7d2fe"
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>}
              />
            </div>
          </section>

          <div className="mb-6">
            <CompletionChart surveys={prioritizedSurveys} />
          </div>

          {data.surveys.length === 0 ? (
            <div className="card">
              <EmptyState
                title="نظرسنجی‌ای برای نمایش وجود ندارد"
                description="بعد از ایجاد نظرسنجی، وضعیت مشارکت کارکنان در این بخش نمایش داده می‌شود."
              />
            </div>
          ) : (
            <section aria-labelledby="survey-progress-list-title">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="survey-progress-list-title" className="section-title">جزئیات نظرسنجی‌ها</h2>
                <p className="text-xs text-gray-500">مرتب‌شده بر اساس نیاز به پیگیری و قدیمی‌ترین پاسخ</p>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {prioritizedSurveys.map((survey) => (
                <SurveyProgressCard key={survey.survey_id} survey={survey} />
              ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
