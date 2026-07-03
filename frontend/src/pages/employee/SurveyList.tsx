import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeeApi } from '../../api/endpoints';
import { Survey } from '../../types';
import { CardGridSkeleton, EmptyState, Skeleton } from '../../components/common/index';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';

type Tab = 'active' | 'closed' | 'completed';

function SurveyCard({ survey }: { survey: Survey }) {
  const completed = (survey.my_votes_count || 0) === (survey.total_people || 0) && (survey.total_people || 0) > 0;
  const isClosed  = survey.status === 'closed';
  const pct       = survey.total_people ? Math.round(((survey.my_votes_count || 0) / survey.total_people) * 100) : 0;
  const firstQuestion = survey.questions?.[0]?.text || survey.question || '';
  const questionCount = survey.questions_count || survey.questions?.length || survey.total_questions || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
      <Link to={`/surveys/${survey.id}`} className="block group">
        <div className="card p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border group-hover:border-[color:var(--c-200)]">

          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-slate-800 text-base leading-snug group-hover:text-[color:var(--c-700)] transition-colors">
                {survey.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{questionCount} سوال برای هر فرد — {firstQuestion}</p>
            </div>
            <div className="flex-shrink-0">
              {completed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  تکمیل شده
                </span>
              ) : isClosed ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--c-50)', color: 'var(--c-700)', border: '1px solid var(--c-200)' }}>
                  بسته شده
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--c-50)', color: 'var(--c-700)', border: '1px solid var(--c-200)' }}>
                  جدید
                </span>
              )}
            </div>
          </div>
{(survey.total_people || 0) > 0 && (
            <div className="mb-3">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: completed ? '#10b981' : 'var(--c-500)' }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{survey.my_votes_count || 0} از {survey.total_people} نفر تکمیل‌شده</span>
                <span>{pct}٪</span>
              </div>
            </div>
          )}
<div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              {survey.total_people || 0} نفر
            </span>
            <span className="flex items-center gap-1">
              {questionCount} سوال
            </span>
          </div>
<div className="mt-3 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium gap-1" style={{ color: 'var(--c-600)' }}>
            مشاهده
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function EmployeeSurveyList() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('active');

  const loadSurveys = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');

    try {
      const response = await employeeApi.surveys(signal);
      const payload = response.data as Survey[] | { results?: Survey[]; surveys?: Survey[] };
      const nextSurveys = Array.isArray(payload)
        ? payload
        : payload.results || payload.surveys || [];
      setSurveys(nextSurveys);
    } catch (error) {
      if (isCanceledRequest(error, signal)) return;
      const message = getErrorMessage(error);
      setLoadError(message);
      setSurveys([]);
      toast.error(message || 'دریافت نظرسنجی‌ها ناموفق بود');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadSurveys(controller.signal);
    return () => controller.abort();
  }, [loadSurveys]);

  if (loading) return (
    <div className="responsive-page">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="card p-3 sm:p-4 space-y-2">
            <Skeleton className="h-6 w-10 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>
      <Skeleton className="h-11 w-full rounded-xl mb-5" />
      <CardGridSkeleton items={6} />
    </div>
  );

  if (loadError) {
    return (
      <div className="card p-8 text-center">
        <h1 className="page-title mb-2">دریافت نظرسنجی‌ها ناموفق بود</h1>
        <p className="text-sm text-gray-500 mb-5">{loadError}</p>
        <button type="button" onClick={() => void loadSurveys()} className="btn-primary">
          تلاش دوباره
        </button>
      </div>
    );
  }

  const active    = surveys.filter(s => s.status === 'published');
  const closed    = surveys.filter(s => s.status === 'closed');
  const completed = surveys.filter(s => (s.my_votes_count || 0) > 0 && (s.my_votes_count || 0) === (s.total_people || 0));

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'active',    label: 'فعال',         count: active.length    },
    { key: 'closed',    label: 'بسته‌شده',     count: closed.length    },
    { key: 'completed', label: 'تکمیل‌شده',   count: completed.length },
  ];

  const displayList = tab === 'active' ? active : tab === 'closed' ? closed : completed;

  return (
    <div className="responsive-page">
      <div className="mb-6">
        <h1 className="page-title">نظرسنجی‌ها</h1>
        <p className="text-sm text-gray-500 mt-1">همه نظرسنجی‌های سازمان</p>
      </div>
<div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        {tabs.map(t => (
          <div key={t.key} className="card p-3 sm:p-4 text-center" style={{ borderTop: '2px solid var(--c-500)' }}>
            <p className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--c-700)' }}>{t.count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.label}</p>
          </div>
        ))}
      </div>
<div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`min-w-[104px] flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
              ${tab === t.key ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            style={tab === t.key ? { color: 'var(--c-700)' } : {}}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold`}
                style={tab === t.key
                  ? { backgroundColor: 'var(--c-100)', color: 'var(--c-700)' }
                  : { backgroundColor: '#e5e7eb', color: '#6b7280' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>
{displayList.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'نظرسنجی فعالی وجود ندارد' : tab === 'closed' ? 'نظرسنجی بسته‌شده‌ای وجود ندارد' : 'هنوز نظرسنجی‌ای را تکمیل نکرده‌اید'}
          description={tab === 'active' ? 'در حال حاضر نظرسنجی منتشرشده‌ای برای شما وجود ندارد' : tab === 'closed' ? 'نظرسنجی‌های بسته‌شده توسط مدیر اینجا نمایش داده می‌شوند' : 'پس از ثبت تمام امتیازهای یک نظرسنجی، اینجا نمایش داده می‌شود'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayList.map(s => <SurveyCard key={s.id} survey={s} />)}
        </div>
      )}
    </div>
  );
}
