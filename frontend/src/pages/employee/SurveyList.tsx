import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeeApi } from '../../api/endpoints';
import { Survey } from '../../types';
import { PageLoader, EmptyState } from '../../components/common/index';
import { formatDateTime, isSurveyExpired } from '../../utils/helpers';
import { motion } from 'framer-motion';

function SurveyCard({ survey }: { survey: Survey }) {
  const completed = (survey.my_votes_count || 0) === (survey.total_people || 0) && (survey.total_people || 0) > 0;
  const partial = (survey.my_votes_count || 0) > 0 && !completed;
  const expired = isSurveyExpired(survey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link to={`/surveys/${survey.id}`} className="block">
        <div className="card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 text-base leading-snug">{survey.title}</h3>
              <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">{survey.question}</p>
            </div>
            {completed ? (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                تکمیل شده
              </span>
            ) : expired ? (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                مهلت به پایان رسیده
              </span>
            ) : partial ? (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                ناقص
              </span>
            ) : (
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                جدید
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {survey.total_people || 0} نفر
            </span>
            {survey.ends_at && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                پایان: {formatDateTime(survey.ends_at)}
              </span>
            )}
            {(survey.my_votes_count || 0) > 0 && (
              <span className="flex items-center gap-1 text-blue-500">
                {survey.my_votes_count} از {survey.total_people} امتیاز ثبت شده
              </span>
            )}
          </div>

          {/* Progress bar */}
          {(survey.total_people || 0) > 0 && (
            <div className="mt-3">
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${((survey.my_votes_count || 0) / (survey.total_people || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default function EmployeeSurveyList() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeeApi.surveys()
      .then(r => setSurveys(Array.isArray(r.data) ? r.data : []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">نظرسنجی‌های فعال</h1>
        <p className="text-sm text-gray-500 mt-1">نظرسنجی‌های در حال اجرا که می‌توانید در آن‌ها شرکت کنید</p>
      </div>

      {surveys.length === 0 ? (
        <EmptyState
          title="نظرسنجی فعالی وجود ندارد"
          description="در حال حاضر نظرسنجی منتشرشده‌ای برای شما وجود ندارد"
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {surveys.map(s => <SurveyCard key={s.id} survey={s} />)}
        </div>
      )}
    </div>
  );
}
