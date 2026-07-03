import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../api/endpoints';
import { DashboardStats, Survey } from '../../types';
import { StatusBadge, DashboardSkeleton } from '../../components/common/index';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import toast from 'react-hot-toast';

function StatCard({ label, value, bgColor, iconColor, icon }: {
  label: string; value: number;
  bgColor: string; iconColor: string; icon: React.ReactNode;
}) {
  return (
    <div className="card p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value.toLocaleString('fa-IR')}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    dashboardApi.stats(controller.signal)
      .then(r => setData(r.data))
      .catch(err => {
        if (isCanceledRequest(err, controller.signal)) return;
        toast.error(getErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return null;

  const { stats, recent_surveys } = data;

  const SIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
  const DIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
  const PIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  const CIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>;
  const RIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>;
  const UIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

  return (
    <div className="responsive-page">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="page-title">داشبورد مدیریت</h1>
          <p className="text-sm text-gray-500 mt-1">خلاصه وضعیت سامانه نظرسنجی سازمانی</p>
        </div>
        <Link to="/admin/survey-progress" className="btn-secondary w-full sm:w-auto self-start">
          پیگیری پیشرفت نظرسنجی‌ها
        </Link>
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="کل نظرسنجی‌ها"  value={stats.total_surveys}     bgColor="var(--c-50)"  iconColor="var(--c-600)" icon={<SIcon />} />
        <StatCard label="پیش‌نویس"        value={stats.draft_surveys}     bgColor="#f9fafb"      iconColor="#6b7280"     icon={<DIcon />} />
        <StatCard label="منتشر شده"       value={stats.published_surveys} bgColor="#ecfdf5"      iconColor="#059669"     icon={<PIcon />} />
        <StatCard label="بسته شده"        value={stats.closed_surveys}    bgColor="var(--c-50)"  iconColor="var(--c-600)" icon={<CIcon />} />
        <StatCard label="کل پاسخ‌ها"     value={stats.total_responses}   bgColor="var(--c-100)" iconColor="var(--c-700)" icon={<RIcon />} />
        <StatCard label="تعداد کارکنان"   value={stats.total_employees}   bgColor="#fffbeb"      iconColor="#d97706"     icon={<UIcon />} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="section-title">آخرین نظرسنجی‌ها</h2>
          <Link to="/admin/surveys" className="text-sm font-medium transition-colors" style={{ color: 'var(--c-600)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--c-700)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--c-600)')}>
            مشاهده همه
          </Link>
        </div>
        {recent_surveys.length === 0
          ? <div className="px-4 sm:px-6 py-10 text-center text-gray-400 text-sm">هنوز نظرسنجی‌ای ایجاد نشده است</div>
          : <div className="divide-y divide-gray-50">
              {recent_surveys.map((survey: Survey) => (
                <div key={survey.id} className="px-4 sm:px-6 py-4 flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{survey.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(survey.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 self-start min-[420px]:self-auto">
                    <StatusBadge status={survey.status} />
                    <Link to={`/admin/surveys/${survey.id}`} className="text-xs hover:underline" style={{ color: 'var(--c-600)' }}>جزئیات</Link>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
