import { useCallback, useEffect, useId, useState } from 'react';
import { dashboardApi } from '../../api/endpoints';
import { PageHeader, EmptyState, Modal, PasswordInput } from '../../components/common/index';
import { formatNumber, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import toast from 'react-hot-toast';

interface DataCounts {
  surveys: number;
  people: number;
  ratings: number;
  employees: number;
}

const CONFIRM_PHRASE = 'حذف همه';

export default function SystemSettingsData() {
  const fieldPrefix = useId();
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    dashboardApi.dataCounts(signal)
      .then(r => setCounts(r.data))
      .catch(err => {
        if (isCanceledRequest(err, signal)) return;
        setLoadError(getErrorMessage(err));
      })
      .finally(() => { if (!signal?.aborted) setLoading(false); });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const closeModal = () => {
    if (deleting) return;
    setModalOpen(false);
    setConfirmText('');
    setPassword('');
  };

  const canDelete = confirmText.trim() === CONFIRM_PHRASE && password.length > 0 && !deleting;

  const handleDeleteAll = async () => {
    if (confirmText.trim() !== CONFIRM_PHRASE || !password) return;
    setDeleting(true);
    try {
      const r = await dashboardApi.deleteAllData(password);
      const d = (r.data as { deleted: DataCounts }).deleted;
      toast.success(`${formatNumber(d.employees)} کارمند، ${formatNumber(d.surveys)} نظرسنجی، ${formatNumber(d.people)} فرد و ${formatNumber(d.ratings)} امتیاز حذف شدند`);
      setModalOpen(false);
      setConfirmText('');
      setPassword('');
      load();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  const rows: { label: string; value: number }[] = counts ? [
    { label: 'نظرسنجی‌ها', value: counts.surveys },
    { label: 'افراد', value: counts.people },
    { label: 'امتیازها', value: counts.ratings },
    { label: 'کارمندان', value: counts.employees },
  ] : [];

  return (
    <div className="responsive-page">
      <PageHeader
        title="تنظیمات سیستم — داده‌ها"
        subtitle="مدیریت و حذف داده‌های سازمان"
      />

      {loadError ? (
        <div className="card">
          <EmptyState
            title="دریافت اطلاعات ناموفق بود"
            description={loadError}
            action={<button onClick={() => load()} className="btn-primary">تلاش دوباره</button>}
          />
        </div>
      ) : (
        <div className="card p-5 mb-6">
          <p className="text-sm font-semibold text-slate-800 mb-4">داده‌های فعلی</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {rows.map(row => (
              <div key={row.label} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-800">{loading ? '—' : formatNumber(row.value)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{row.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-red-200 rounded-xl p-5 bg-red-50">
        <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3">
          <div>
            <p className="font-semibold text-red-700 text-sm">ناحیه خطر</p>
            <p className="text-xs text-red-500 mt-0.5">حذف تمام نظرسنجی‌ها، افراد و امتیازها — غیرقابل بازگشت</p>
          </div>
          <button
            onClick={() => { setModalOpen(true); setConfirmText(''); setPassword(''); }}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
          >
            حذف تمام داده‌ها
          </button>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="حذف تمام داده‌ها"
        size="sm"
        dismissible={!deleting}
        busy={deleting}
        bodyClassName="p-5 sm:p-6"
        footer={(
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={!canDelete}
              className="min-h-11 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {deleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              حذف تمام داده‌ها
            </button>
            <button type="button" onClick={closeModal} className="btn-secondary" disabled={deleting}>انصراف</button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 18.333 3.924 20 5.464 20z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">این عملیات غیرقابل بازگشت است</p>
              <p className="text-xs text-red-600 mt-1">تمام نظرسنجی‌ها، افراد و امتیازها برای همیشه حذف می‌شوند. حساب‌های کاربری مدیران دست نخورده باقی می‌مانند.</p>
            </div>
          </div>
          {counts && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600 space-y-1">
              <p>موارد زیر حذف خواهند شد:</p>
              <p className="font-medium text-slate-700">
                {formatNumber(counts.surveys)} نظرسنجی، {formatNumber(counts.people)} فرد، {formatNumber(counts.ratings)} امتیاز و {formatNumber(counts.employees)} کارمند
              </p>
            </div>
          )}
          <div>
            <label htmlFor={`${fieldPrefix}-confirm`} className="label">برای تأیید، عبارت «حذف همه» را تایپ کنید</label>
            <input
              id={`${fieldPrefix}-confirm`}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="input-field"
              placeholder="حذف همه"
            />
          </div>
          <div>
            <label htmlFor={`${fieldPrefix}-password`} className="label">رمز عبور خود را وارد کنید</label>
            <PasswordInput id={`${fieldPrefix}-password`} value={password} onChange={setPassword} placeholder="رمز عبور" autoComplete="current-password" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
