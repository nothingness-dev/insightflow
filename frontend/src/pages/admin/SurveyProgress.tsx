import { useCallback, useEffect, useState } from 'react';
import { dashboardApi } from '../../api/endpoints';
import { SurveyProgress, SurveyProgressDashboard } from '../../types';
import { EmptyState, PageHeader, ProgressListSkeleton, StatusBadge } from '../../components/common/index';
import { getErrorMessage } from '../../utils/helpers';

const numberFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function progressTone(percentage: number) {
  if (percentage <= 40) {
    return {
      bar: 'bg-red-500',
      text: 'text-red-700',
      badge: 'bg-red-50 text-red-700 border-red-100',
      label: 'نیازمند پیگیری',
    };
  }

  if (percentage <= 80) {
    return {
      bar: 'bg-amber-400',
      text: 'text-amber-700',
      badge: 'bg-amber-50 text-amber-700 border-amber-100',
      label: 'در حال پیشرفت',
    };
  }

  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    label: 'مشارکت عالی',
  };
}

function ProgressBar({ percentage }: { percentage: number }) {
  const tone = progressTone(percentage);

  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100"
      role="progressbar"
      aria-label="درصد تکمیل نظرسنجی"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
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
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="card p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: accent }}
      >
        <span className="text-slate-700">{icon}</span>
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
        <h2 className="section-title">مقایسه نرخ تکمیل نظرسنجی‌ها</h2>
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
                    {formatNumber(survey.completion_percentage)}٪
                  </span>
                </div>
                <ProgressBar percentage={survey.completion_percentage} />
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
          <li key={user.id} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
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
      <div className="p-4 sm:p-5">
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

          {survey.tracking_enabled ? (
            <span className={`inline-flex self-start items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone.badge}`}>
              {tone.label}
            </span>
          ) : (
            <span className="inline-flex self-start items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500">
              تا انتشار غیرفعال
            </span>
          )}
        </div>

        {survey.tracking_enabled ? (
          <>
            <div className="mt-6 flex flex-col min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between gap-3">
              <div>
                <p className={`text-3xl font-bold ${tone.text}`}>
                  {formatNumber(survey.completion_percentage)}٪
                </p>
                <p className="text-xs text-gray-400 mt-1">نرخ تکمیل</p>
              </div>
              <p className="text-xs text-gray-500 text-left">
                {formatNumber(survey.completed_employees)} از {formatNumber(survey.assigned_employees)} کارمند
              </p>
            </div>

            <div className="mt-3">
              <ProgressBar percentage={survey.completion_percentage} />
            </div>
<p className="mt-2 text-[11px] text-gray-400">
              کارمند «تکمیل‌شده» یعنی به تمام سوال‌ها برای تمام افراد فعال پاسخ داده است.
            </p>

            <dl className="mt-5 grid grid-cols-2 min-[420px]:grid-cols-4 divide-y-0 divide-x min-[420px]:divide-x divide-x-reverse min-[420px]:divide-x-reverse divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/70">
              <div className="p-3 text-center">
                <dt className="text-xs text-gray-400">تخصیص‌یافته</dt>
                <dd className="mt-1 text-lg font-bold text-slate-700">{formatNumber(survey.assigned_employees)}</dd>
              </div>
              <div className="p-3 text-center">
                <dt className="text-xs text-gray-400">کارمند تکمیل</dt>
                <dd className="mt-1 text-lg font-bold text-emerald-600">{formatNumber(survey.completed_employees)}</dd>
              </div>
              <div className="p-3 text-center border-t min-[420px]:border-t-0 border-gray-100">
                <dt className="text-xs text-gray-400">ناشناس تکمیل</dt>
                <dd className="mt-1 text-lg font-bold text-indigo-600">{formatNumber(survey.anonymous_participants)}</dd>
              </div>
              <div className="p-3 text-center border-t min-[420px]:border-t-0 border-gray-100">
                <dt className="text-xs text-gray-400">در انتظار</dt>
                <dd className="mt-1 text-lg font-bold text-amber-600">{formatNumber(survey.pending_employees)}</dd>
              </div>
            </dl>
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

      {survey.tracking_enabled && (
        <div className="border-t border-gray-100">
          <button
            type="button"
            onClick={handleToggle}
            className="w-full px-5 py-3.5 flex items-center justify-between text-sm font-medium text-slate-600 hover:bg-gray-50 transition-colors"
            aria-expanded={expanded}
          >
            <span className="flex items-center gap-3">
              <span>کارکنان در انتظار ({formatNumber(survey.pending_employees)})</span>
              {survey.anonymous_participants > 0 && (
                <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
                  {formatNumber(survey.anonymous_participants)} ناشناس ✓
                </span>
              )}
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
            <div className="px-5 pb-5">
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

  const loadProgress = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await dashboardApi.surveyProgress();
      setData(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

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
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
            <SummaryCard
              label="کل نظرسنجی‌ها"
              value={formatNumber(data.summary.total_surveys)}
              accent="var(--c-50)"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" /></svg>}
            />
            <SummaryCard
              label="کل پاسخ‌های تخصیص‌یافته"
              value={formatNumber(data.summary.total_assigned_responses)}
              accent="#eff6ff"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>}
            />
            <SummaryCard
              label="کارمندان تکمیل‌شده"
              value={formatNumber(data.summary.total_completed_responses)}
              accent="#ecfdf5"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
            />
            <SummaryCard
              label="شرکت‌کنندگان ناشناس"
              value={formatNumber(data.summary.total_anonymous_participants)}
              accent="#eef2ff"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>}
            />
            <SummaryCard
              label="نرخ تکمیل کلی"
              value={`${formatNumber(data.summary.overall_completion_percentage)}٪`}
              accent="#fffbeb"
              icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16l4-5 3 3 5-7" /></svg>}
            />
          </section>

          <div className="mb-6">
            <CompletionChart surveys={data.surveys} />
          </div>

          {data.surveys.length === 0 ? (
            <div className="card">
              <EmptyState
                title="نظرسنجی‌ای برای نمایش وجود ندارد"
                description="بعد از ایجاد نظرسنجی، وضعیت مشارکت کارکنان در این بخش نمایش داده می‌شود."
              />
            </div>
          ) : (
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {data.surveys.map((survey) => (
                <SurveyProgressCard key={survey.survey_id} survey={survey} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
