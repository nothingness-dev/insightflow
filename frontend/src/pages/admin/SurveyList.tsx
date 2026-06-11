import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminSurveyApi } from '../../api/endpoints';
import { Survey } from '../../types';
import { StatusBadge, PageHeader, EmptyState, PageLoader, SearchInput, ConfirmModal } from '../../components/common/index';
import { formatDate, getErrorMessage, isSurveyExpired } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function AdminSurveyList() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishId, setPublishId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [closeId, setCloseId] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    adminSurveyApi.list(params)
      .then(r => setSurveys(Array.isArray(r.data) ? r.data : (r.data as any).results || []))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminSurveyApi.delete(deleteId);
      toast.success('نظرسنجی حذف شد');
      setSurveys(s => s.filter(x => x.id !== deleteId));
      setDeleteId(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  const handlePublish = async () => {
    if (!publishId) return;
    setPublishing(true);
    try {
      const r = await adminSurveyApi.publish(publishId);
      toast.success('نظرسنجی منتشر شد');
      setSurveys(s => s.map(x => x.id === publishId ? r.data : x));
      setPublishId(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setPublishing(false); }
  };

  const handleClose = async () => {
    if (!closeId) return;
    setClosing(true);
    try {
      const r = await adminSurveyApi.close(closeId);
      toast.success('نظرسنجی بسته شد');
      setSurveys(s => s.map(x => x.id === closeId ? r.data : x));
      setCloseId(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setClosing(false); }
  };

  return (
    <div>
      <PageHeader
        title="نظرسنجی‌ها"
        subtitle="مدیریت و پیگیری تمام نظرسنجی‌های سازمان"
        action={
          <button onClick={() => navigate('/admin/surveys/new')} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            نظرسنجی جدید
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="جستجو در عنوان یا سوال..." />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-field sm:w-44"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="draft">پیش‌نویس</option>
          <option value="published">منتشر شده</option>
          <option value="closed">بسته شده</option>
        </select>
      </div>

      {loading ? <PageLoader /> : surveys.length === 0 ? (
        <div className="card">
          <EmptyState
            title="نظرسنجی یافت نشد"
            description="اولین نظرسنجی خود را ایجاد کنید"
            action={
              <button onClick={() => navigate('/admin/surveys/new')} className="btn-primary">
                ایجاد نظرسنجی
              </button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">عنوان</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">وضعیت</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">افراد</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">پاسخ‌ها</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">تاریخ ایجاد</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {surveys.map(survey => (
                  <tr key={survey.id} className="table-row">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{survey.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{survey.question}</p>
                        <div className="md:hidden mt-1"><StatusBadge status={survey.status} expired={isSurveyExpired(survey)} /></div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell"><StatusBadge status={survey.status} expired={isSurveyExpired(survey)} /></td>
                    <td className="px-4 py-4 hidden lg:table-cell text-gray-600">{survey.people_count}</td>
                    <td className="px-4 py-4 hidden lg:table-cell text-gray-600">{survey.total_responses}</td>
                    <td className="px-4 py-4 hidden md:table-cell text-gray-500 text-xs">{formatDate(survey.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        <Link
                          to={`/admin/surveys/${survey.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          جزئیات
                        </Link>
                        {survey.status === 'draft' && (
                          <>
                            <Link
                              to={`/admin/surveys/${survey.id}/edit`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                              ویرایش
                            </Link>
                            <button
                              onClick={() => setPublishId(survey.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              انتشار
                            </button>
                            <button
                              onClick={() => setDeleteId(survey.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              حذف
                            </button>
                          </>
                        )}
                        {survey.status === 'published' && (
                          <button
                            onClick={() => setCloseId(survey.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            بستن
                          </button>
                        )}
                        {survey.status === 'closed' && (
                          <Link
                            to={`/admin/surveys/${survey.id}/results`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          >
                            نتایج
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="حذف نظرسنجی"
        message="آیا از حذف این نظرسنجی اطمینان دارید؟ این عمل قابل بازگشت نیست."
        confirmLabel="حذف"
        loading={deleting}
      />
      <ConfirmModal
        open={!!publishId}
        onClose={() => setPublishId(null)}
        onConfirm={handlePublish}
        title="انتشار نظرسنجی"
        message="پس از انتشار، کارکنان می‌توانند در نظرسنجی شرکت کنند. آیا مطمئن هستید؟"
        confirmLabel="انتشار"
        confirmVariant="primary"
        loading={publishing}
      />
      <ConfirmModal
        open={!!closeId}
        onClose={() => setCloseId(null)}
        onConfirm={handleClose}
        title="بستن نظرسنجی"
        message="پس از بستن، امکان ثبت امتیاز وجود نخواهد داشت و نتایج نهایی می‌شوند."
        confirmLabel="بستن نظرسنجی"
        confirmVariant="danger"
        loading={closing}
      />
    </div>
  );
}
