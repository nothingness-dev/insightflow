import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminSurveyApi } from '../../api/endpoints';
import { Survey } from '../../types';
import { StatusBadge, PageHeader, EmptyState, SearchInput, Select, ConfirmModal, TableSkeleton, ActionMenu } from '../../components/common/index';
import type { ActionMenuItem } from '../../components/common/index';
import { formatDate, formatNumber, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import toast from 'react-hot-toast';

const PAGE_SIZE = 8;
type SurveySort = 'newest' | 'oldest' | 'responses' | 'status';

const STATUS_LABELS: Record<Survey['status'], string> = {
  draft: 'پیش‌نویس',
  published: 'منتشر شده',
  closed: 'بسته شده',
};

const STATUS_ORDER: Record<Survey['status'], number> = {
  draft: 0,
  published: 1,
  closed: 2,
};

export default function AdminSurveyList() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState<SurveySort>('newest');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishId, setPublishId] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [closeId, setCloseId] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const publishSurvey = surveys.find(survey => survey.id === publishId);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;
    adminSurveyApi.list(params, signal)
      .then(r => setSurveys(Array.isArray(r.data) ? r.data : (r.data as any).results || []))

      .catch(err => {
        if (isCanceledRequest(err, signal)) return;
        toast.error(getErrorMessage(err));
        setSurveys([]);
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => setPage(1), [debouncedSearch, statusFilter, sort]);

  const sortedSurveys = useMemo(() => {
    const result = [...surveys];
    result.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sort === 'responses') {
        return b.total_responses - a.total_responses || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sort === 'status') {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return result;
  }, [surveys, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedSurveys.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = sortedSurveys.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, sortedSurveys.length);
  const visibleSurveys = sortedSurveys.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const hasActiveFilters = Boolean(search.trim() || statusFilter);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
  };

  const getSurveyActions = (survey: Survey): ActionMenuItem[] => [
    { label: 'مشاهده جزئیات', onClick: () => navigate(`/admin/surveys/${survey.id}`) },
    ...(survey.status === 'closed' ? [
      { label: 'مشاهده نتایج', onClick: () => navigate(`/admin/surveys/${survey.id}/results`) },
    ] : []),
    ...(survey.status === 'draft' ? [
      { label: 'ویرایش', onClick: () => navigate(`/admin/surveys/${survey.id}/edit`) },
      { label: 'انتشار', onClick: () => setPublishId(survey.id) },
    ] : []),
    { label: 'کپی', onClick: () => setDuplicateId(survey.id) },
    ...(survey.status === 'published' ? [
      { label: 'بستن', onClick: () => setCloseId(survey.id) },
    ] : []),
    ...(survey.status === 'draft' ? [
      { label: 'حذف', danger: true, onClick: () => setDeleteId(survey.id) },
    ] : []),
  ];

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


  const handleDuplicate = async () => {
    if (!duplicateId) return;

    setDuplicating(true);
    try {
      const response = await adminSurveyApi.duplicate(duplicateId);
      toast.success('کپی نظرسنجی به‌صورت پیش‌نویس ایجاد شد');
      setDuplicateId(null);
      navigate(`/admin/surveys/${response.data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDuplicating(false);
    }
  };

  return (
    <div className="responsive-page">
      <PageHeader
        title="نظرسنجی‌ها"
        subtitle="مدیریت و پیگیری تمام نظرسنجی‌های سازمان"
        action={
          <button onClick={() => navigate('/admin/surveys/new')} className="btn-primary w-full sm:w-auto flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            نظرسنجی جدید
          </button>
        }
      />
      <div className="flex flex-col lg:flex-row gap-3 mb-3">
        <div className="flex-1">
          <SearchInput
            id="survey-search"
            value={search}
            onChange={setSearch}
            placeholder="جستجو در عنوان یا سوال..."
            ariaLabel="جستجوی نظرسنجی‌ها"
          />
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 lg:flex lg:w-auto">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-full lg:w-44"
            placeholder="همه وضعیت‌ها"
            options={[
              { value: '', label: 'همه وضعیت‌ها' },
              { value: 'draft', label: 'پیش‌نویس' },
              { value: 'published', label: 'منتشر شده' },
              { value: 'closed', label: 'بسته شده' },
            ]}
          />
          <Select
            value={sort}
            onChange={value => setSort(value as SurveySort)}
            className="w-full lg:w-48"
            placeholder="مرتب‌سازی"
            options={[
              { value: 'newest', label: 'جدیدترین' },
              { value: 'oldest', label: 'قدیمی‌ترین' },
              { value: 'responses', label: 'بیشترین پاسخ' },
              { value: 'status', label: 'بر اساس وضعیت' },
            ]}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mb-5" aria-label="فیلترهای فعال">
          <span className="text-xs font-medium text-gray-500">فیلترهای فعال:</span>
          {search.trim() && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={`حذف فیلتر جستجو: ${search.trim()}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--c-200)] bg-[color:var(--c-50)] px-3 py-1 text-xs font-medium text-[color:var(--c-700)] hover:bg-[color:var(--c-100)]"
            >
              جستجو: «<span className="max-w-48 truncate">{search.trim()}</span>»
              <span aria-hidden="true" className="text-base leading-none">×</span>
            </button>
          )}
          {statusFilter && (
            <button
              type="button"
              onClick={() => setStatusFilter('')}
              aria-label={`حذف فیلتر وضعیت: ${STATUS_LABELS[statusFilter as Survey['status']]}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[color:var(--c-200)] bg-[color:var(--c-50)] px-3 py-1 text-xs font-medium text-[color:var(--c-700)] hover:bg-[color:var(--c-100)]"
            >
              وضعیت: {STATUS_LABELS[statusFilter as Survey['status']]}
              <span aria-hidden="true" className="text-base leading-none">×</span>
            </button>
          )}
          {search.trim() && statusFilter && (
            <button type="button" onClick={clearFilters} className="min-h-9 px-2 text-xs font-medium text-gray-500 hover:text-gray-800">
              پاک کردن همه
            </button>
          )}
        </div>
      )}

      {loading ? <TableSkeleton rows={6} /> : surveys.length === 0 ? (
        <div className="card">
          <EmptyState
            title={hasActiveFilters ? 'نتیجه‌ای پیدا نشد' : 'هنوز نظرسنجی ساخته نشده است'}
            description={hasActiveFilters ? 'عبارت جستجو یا فیلتر وضعیت را تغییر دهید.' : 'اولین نظرسنجی را بسازید و قبل از انتشار پیش‌نمایش آن را بررسی کنید.'}
            action={
              hasActiveFilters ? (
                <button onClick={clearFilters} className="btn-secondary">پاک کردن فیلترها</button>
              ) : (
                <button onClick={() => navigate('/admin/surveys/new')} className="btn-primary">ایجاد نظرسنجی</button>
              )
            }
          />
        </div>      ) : (
        <div className="card overflow-visible">
          <div className="divide-y divide-gray-100 sm:hidden">
            {visibleSurveys.map((survey, index) => (
              <article key={survey.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/admin/surveys/${survey.id}`}
                      title={survey.title}
                      className="inline-flex min-h-11 max-w-full items-center text-sm font-semibold leading-6 text-slate-800 hover:text-[color:var(--c-700)]"
                    >
                      <span className="line-clamp-2 break-words">{survey.title}</span>
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatNumber(survey.questions_count || survey.questions?.length || 0)} سوال
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      {formatNumber(survey.people_count)} نفر
                    </p>
                  </div>
                  <ActionMenu
                    label={`عملیات نظرسنجی ${survey.title}`}
                    placement={index >= visibleSurveys.length - 2 ? 'top' : 'bottom'}
                    items={getSurveyActions(survey)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-50 pt-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={survey.status} />
                    <span className="text-xs text-gray-400">{formatDate(survey.created_at)}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatNumber(survey.total_responses)} پاسخ</span>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto rounded-t-xl sm:block">
            <table className="responsive-table w-full min-w-[680px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">عنوان</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">وضعیت</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">پاسخ‌ها</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">تاریخ ایجاد</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleSurveys.map((survey, index) => (
                  <tr key={survey.id} className="table-row">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="max-w-md">
                        <Link
                          to={`/admin/surveys/${survey.id}`}
                          title={survey.title}
                          className="inline-flex min-h-11 max-w-full items-center text-sm font-semibold leading-6 text-slate-800 hover:text-[color:var(--c-700)] focus-visible:text-[color:var(--c-700)]"
                        >
                          <span className="line-clamp-2 break-words">{survey.title}</span>
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatNumber(survey.questions_count || survey.questions?.length || 0)} سوال
                          <span aria-hidden="true" className="mx-1.5">·</span>
                          {formatNumber(survey.people_count)} نفر
                        </p>
                        <div className="md:hidden mt-1"><StatusBadge status={survey.status} /></div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell"><StatusBadge status={survey.status} /></td>
                    <td className="px-4 py-4 hidden lg:table-cell text-gray-600">{formatNumber(survey.total_responses)}</td>
                    <td className="px-4 py-4 hidden md:table-cell text-gray-500 text-xs">{formatDate(survey.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          label={`عملیات نظرسنجی ${survey.title}`}
                          placement={index >= visibleSurveys.length - 2 ? 'top' : 'bottom'}
                          items={getSurveyActions(survey)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-4 sm:px-5 py-4 rounded-b-xl">
            <p className="text-xs text-gray-500" aria-live="polite">
              نمایش {formatNumber(pageStart)} تا {formatNumber(pageEnd)} از {formatNumber(sortedSurveys.length)} نظرسنجی
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="btn-secondary !px-3 !py-1.5 disabled:opacity-40"
              >
                قبلی
              </button>
              <span className="min-w-20 text-center text-xs font-semibold text-gray-600">
                صفحه {formatNumber(currentPage)} از {formatNumber(totalPages)}
              </span>
              <button
                type="button"
                onClick={() => setPage(current => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary !px-3 !py-1.5 disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!duplicateId}
        onClose={() => setDuplicateId(null)}
        onConfirm={handleDuplicate}
        title="کپی نظرسنجی"
        message="یک نسخه پیش‌نویس از تنظیمات و افراد این نظرسنجی ساخته می‌شود. پاسخ‌ها و توضیحات ثبت‌شده کپی نخواهند شد."
        confirmLabel="ساخت کپی"
        confirmVariant="primary"
        loading={duplicating}
      />
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
