import { formatNumber } from '../../utils/helpers';

type ParticipationProgressProps = {
  completed: number;
  total: number;
  testId: string;
};

export default function ParticipationProgress({ completed, total, testId }: ParticipationProgressProps) {
  const safeTotal = Math.max(total, 0);
  const safeCompleted = Math.min(Math.max(completed, 0), safeTotal);
  const remaining = Math.max(safeTotal - safeCompleted, 0);
  const percentage = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0;

  return (
    <section
      data-testid={testId}
      className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4 dark:border-gray-700 dark:bg-gray-800"
      aria-label="پیشرفت تکمیل نظرسنجی"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700 dark:text-gray-100">
            {formatNumber(safeCompleted)} از {formatNumber(safeTotal)} نفر تکمیل شد
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400" aria-live="polite" aria-atomic="true">
            {remaining > 0
              ? `${formatNumber(remaining)} نفر دیگر باقی مانده است`
              : 'همه پاسخ‌ها تکمیل شده‌اند'}
          </p>
        </div>
        <span className="flex-shrink-0 text-xs font-semibold text-gray-500 dark:text-gray-300">
          {formatNumber(percentage)}٪
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700"
        role="progressbar"
        aria-label="میزان تکمیل نظرسنجی"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCompleted}
        aria-valuetext={`${formatNumber(safeCompleted)} از ${formatNumber(safeTotal)} نفر تکمیل شده`}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </section>
  );
}
