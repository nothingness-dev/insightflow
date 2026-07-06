import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminHashLinkApi } from '../../api/endpoints';
import { HashLinkExpiryUnit, SurveyHashLink } from '../../types';
import { getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import { Skeleton } from '../common';
import QrCodeModal from './QrCodeModal';

interface Props {
  surveyId: number;
  surveyStatus: 'draft' | 'published' | 'closed';
}

function LinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function CopyIcon({ copied }: { copied?: boolean }) {
  if (copied) {
    return (
      <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 3h3m-3 3h3m-6-3h.01M17 14h.01M20 14h.01M14 20h.01" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function HashLinksSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-3 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-full max-w-xs rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-32 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-16 rounded" />
              <Skeleton className="h-7 w-7 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const EXPIRY_UNIT_LABELS: Record<HashLinkExpiryUnit, string> = {
  hours: 'ساعت',
  days: 'روز',
  weeks: 'هفته',
};

type DurationParts = {
  hours: string;
  days: string;
  weeks: string;
};

const emptyDuration: DurationParts = { hours: '', days: '', weeks: '' };

const numberInputClass = 'hash-limit-number-input w-full rounded-lg border border-gray-200 bg-gray-50/80 px-2.5 py-3 text-center text-sm font-semibold text-slate-800 outline-none transition-colors focus:border-[color:var(--c-500)] focus:ring-2 focus:ring-[color:var(--c-100)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function digitsOnly(value: string) {
  return value
    .replace(/[۰-۹]/g, digit => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
}

function toPersianNumber(value: string | number) {
  return String(value).replace(/\d/g, digit => persianDigits[Number(digit)]);
}

function numericValue(value: string) {
  return Number(digitsOnly(value)) || 0;
}

function getMinimumExpiryHours(createdAt: string) {
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return 1;
  return Math.max(1, Math.floor((Date.now() - createdTime) / (60 * 60 * 1000)) + 1);
}

function durationToHours(duration: DurationParts) {
  return (
    numericValue(duration.weeks) * 7 * 24 +
    numericValue(duration.days) * 24 +
    numericValue(duration.hours)
  );
}

function splitDuration(value?: number | null, unit?: HashLinkExpiryUnit | null): DurationParts {
  if (!value || !unit) return { ...emptyDuration };

  const totalHours =
    unit === 'weeks' ? value * 7 * 24 :
    unit === 'days' ? value * 24 :
    value;
  const weeks = Math.floor(totalHours / (7 * 24));
  const remainingAfterWeeks = totalHours % (7 * 24);
  const days = Math.floor(remainingAfterWeeks / 24);
  const hours = remainingAfterWeeks % 24;

  return {
    weeks: weeks ? toPersianNumber(weeks) : '',
    days: days ? toPersianNumber(days) : '',
    hours: hours ? toPersianNumber(hours) : '',
  };
}

function DurationFields({
  value,
  onChange,
}: {
  value: DurationParts;
  onChange: (value: DurationParts) => void;
}) {
  const fields: Array<{ key: keyof DurationParts; label: string; max?: number }> = [
    { key: 'hours', label: 'ساعت', max: 23 },
    { key: 'days', label: 'روز', max: 6 },
    { key: 'weeks', label: 'هفته' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {fields.map(field => (
        <label
          key={field.key}
          className="hash-limit-duration-field min-w-0 rounded-lg border border-gray-200 bg-gray-50/80 px-2.5 py-2 transition-colors focus-within:border-[color:var(--c-500)] focus-within:ring-2 focus-within:ring-[color:var(--c-100)]"
        >
          <span className="hash-limit-duration-label block text-[10px] font-medium text-gray-400 text-center mb-1">{field.label}</span>
          <input
            type="text"
            dir="rtl"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value[field.key]}
            onChange={e => {
              let next = digitsOnly(e.target.value);
              if (field.max != null && Number(next) > field.max) next = String(field.max);
              onChange({ ...value, [field.key]: toPersianNumber(next) });
            }}
            placeholder="۰"
            className="hash-limit-duration-input w-full bg-transparent text-center text-sm font-semibold text-slate-800 outline-none"
          />
        </label>
      ))}
    </div>
  );
}

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    el.style.top = '0';
    el.style.left = '0';
    document.body.appendChild(el);
    el.focus();
    el.select();

    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      ok ? resolve() : reject(new Error('execCommand failed'));
    } catch (err) {
      document.body.removeChild(el);
      reject(err);
    }
  });
}

export default function HashLinksPanel({ surveyId, surveyStatus }: Props) {
  const [links, setLinks] = useState<SurveyHashLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [labelError, setLabelError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [qrLink, setQrLink] = useState<SurveyHashLink | null>(null);
  const [limitsEditId, setLimitsEditId] = useState<number | null>(null);
  const [savingLimitsId, setSavingLimitsId] = useState<number | null>(null);

  // Create-form optional limits
  const [useMaxParticipants, setUseMaxParticipants] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiryDuration, setExpiryDuration] = useState<DurationParts>({ ...emptyDuration });

  // Per-link edit-limits form state
  const [editMaxParticipants, setEditMaxParticipants] = useState('');
  const [editUseMaxParticipants, setEditUseMaxParticipants] = useState(false);
  const [editUseExpiry, setEditUseExpiry] = useState(false);
  const [editExpiryDuration, setEditExpiryDuration] = useState<DurationParts>({ ...emptyDuration });

  const rawBase = (import.meta.env.VITE_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const baseUrl = rawBase || window.location.origin;

  const load = (signal?: AbortSignal) => {
    if (!Number.isFinite(surveyId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    adminHashLinkApi.list(surveyId, signal)
      .then(r => {
        if (signal?.aborted) return;
        setLinks(r.data);
      })
      .catch(error => {
        if (isCanceledRequest(error, signal) || signal?.aborted) return;
        toast.error('خطا در بارگذاری لینک‌ها');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [surveyId]);

  const handleCreate = async () => {
    const label = newLabel.trim();
    const normalizedLabel = label.toLocaleLowerCase('fa-IR');
    const hasDuplicateLabel = Boolean(label) && links.some(link =>
      (link.label || '').trim().toLocaleLowerCase('fa-IR') === normalizedLabel
    );

    if (hasDuplicateLabel) {
      setLabelError('برای این نظرسنجی لینکی با همین نام وجود دارد.');
      toast.error('نام لینک تکراری است');
      return;
    }

    const createMaxParticipants = numericValue(maxParticipants);

    if (useMaxParticipants && createMaxParticipants < 1) {
      toast.error('حداکثر تعداد شرکت‌کنندگان باید عددی بزرگ‌تر از صفر باشد');
      return;
    }
    const createExpiryHours = durationToHours(expiryDuration);

    if (useExpiry && createExpiryHours < 1) {
      toast.error('مقدار مدت انقضا باید عددی بزرگ‌تر از صفر باشد');
      return;
    }

    setCreating(true);
    setLabelError('');
    try {
      const r = await adminHashLinkApi.create(surveyId, {
        label,
        max_participants: useMaxParticipants ? createMaxParticipants : null,
        expiry_value: useExpiry ? createExpiryHours : null,
        expiry_unit: useExpiry ? 'hours' : null,
      });
      setLinks(prev => [r.data, ...prev]);
      setNewLabel('');
      setLabelError('');
      setShowCreate(false);
      setUseMaxParticipants(false);
      setMaxParticipants('');
      setUseExpiry(false);
      setExpiryDuration({ ...emptyDuration });
      toast.success('لینک ناشناس ایجاد شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const openLimitsEditor = (link: SurveyHashLink) => {
    setLimitsEditId(link.id);
    setEditUseMaxParticipants(link.max_participants != null);
    setEditMaxParticipants(link.max_participants != null ? toPersianNumber(link.max_participants) : '');
    setEditUseExpiry(!!link.expiry_value && !!link.expiry_unit);
    setEditExpiryDuration(splitDuration(link.expiry_value, link.expiry_unit));
  };

  const handleSaveLimits = async (link: SurveyHashLink) => {
    const editMaxParticipantsValue = numericValue(editMaxParticipants);
    const minNextParticipants = link.anonymous_participant_count + 1;
    const minExpiryHours = getMinimumExpiryHours(link.created_at);

    if (editUseMaxParticipants && editMaxParticipantsValue < 1) {
      toast.error('حداکثر تعداد شرکت‌کنندگان باید عددی بزرگ‌تر از صفر باشد');
      return;
    }
    if (editUseMaxParticipants && editMaxParticipantsValue < minNextParticipants) {
      toast.error('محدودیت نمی‌تواند از تعداد شرکت‌کنندگان فعلی کمتر باشد');
      return;
    }

    const editExpiryHours = durationToHours(editExpiryDuration);

    if (editUseExpiry && editExpiryHours < 1) {
      toast.error('مقدار مدت انقضا باید عددی بزرگ‌تر از صفر باشد');
      return;
    }

    if (editUseExpiry && editExpiryHours < minExpiryHours) {
      toast.error(`مهلت انقضا باید حداقل ${toPersianNumber(minExpiryHours)} ساعت باشد`);
      return;
    }

    setSavingLimitsId(link.id);
    try {
      const r = await adminHashLinkApi.update(link.id, {
        max_participants: editUseMaxParticipants ? editMaxParticipantsValue : null,
        expiry_value: editUseExpiry ? editExpiryHours : null,
        expiry_unit: editUseExpiry ? 'hours' : null,
      });
      setLinks(prev => prev.map(l => l.id === link.id ? r.data : l));
      toast.success('محدودیت‌های لینک به‌روزرسانی شد');
      setLimitsEditId(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingLimitsId(null);
    }
  };

  const handleToggle = async (link: SurveyHashLink) => {
    setTogglingId(link.id);
    try {
      const r = await adminHashLinkApi.update(link.id, { is_active: !link.is_active });
      setLinks(prev => prev.map(l => l.id === link.id ? r.data : l));
      toast.success(r.data.is_active ? 'لینک فعال شد' : 'لینک غیرفعال شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا مطمئن هستید که می‌خواهید این لینک را حذف کنید؟')) return;

    setDeletingId(id);
    try {
      await adminHashLinkApi.delete(id);
      setLinks(prev => prev.filter(l => l.id !== id));
      toast.success('لینک حذف شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const copyLink = async (token: string) => {
    const url = `${baseUrl}/s/${token}`;
    try {
      await copyToClipboard(url);
      setCopiedToken(token);
      toast.success('لینک کپی شد');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error(`کپی ناموفق - لینک: ${url}`, { duration: 6000 });
    }
  };

  return (
    <div className="card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LinkIcon />
          <h2 className="text-base font-semibold text-slate-800">لینک‌های ناشناس</h2>
        </div>
        {surveyStatus === 'published' && (
          <button
            onClick={() => setShowCreate(v => !v)}
            className="btn-primary text-xs px-3 py-1.5"
          >
            + لینک جدید
          </button>
        )}
      </div>

      {surveyStatus === 'draft' && (
        <p className="text-sm text-gray-400 text-center py-4">
          پس از انتشار نظرسنجی می‌توانید لینک ناشناس ایجاد کنید.
        </p>
      )}

      {surveyStatus === 'closed' && links.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">لینک ناشناسی ایجاد نشده است.</p>
      )}

      {showCreate && (
        <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex flex-col gap-1 mb-3">
            <p className="text-sm font-semibold text-slate-800">نام لینک ناشناس</p>
            <p className="text-xs text-gray-400 leading-relaxed">یک نام داخلی برای تشخیص لینک وارد کنید؛ این نام برای شرکت‌کننده‌ها نمایش داده نمی‌شود.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={newLabel}
                onChange={e => {
                  setNewLabel(e.target.value);
                  if (labelError) setLabelError('');
                }}
                placeholder="مثلا: واحد منابع انسانی، گروه مدیران، شیفت صبح"
                className={`input-field w-full pr-9 ${labelError ? 'border-red-400 focus:ring-red-200' : ''}`}
                maxLength={200}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300">
                <LinkIcon />
              </span>
            </div>
            <div className="flex gap-2 sm:flex-shrink-0">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-primary flex-1 sm:flex-none text-sm px-4"
              >
                {creating ? 'در حال ساخت...' : 'ساخت لینک'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewLabel(''); setLabelError(''); }}
                className="btn-secondary flex-1 sm:flex-none text-sm px-4"
              >
                انصراف
              </button>
            </div>
          </div>
          {labelError && (
            <p className="mt-2 text-xs font-medium text-red-500">{labelError}</p>
          )}
          <div className="flex items-center justify-between gap-2 mt-2">
            <p className="text-[11px] text-gray-400">خالی گذاشتن نام هم مجاز است.</p>
            <p className="text-[11px] text-gray-300">{toPersianNumber(newLabel.length)}/{toPersianNumber(200)}</p>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="hash-limit-card rounded-lg border border-gray-200 p-3">
              <label className="hash-limit-title flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useMaxParticipants}
                  onChange={e => setUseMaxParticipants(e.target.checked)}
                  style={{ accentColor: 'var(--c-600)' }}
                  className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                />
                <span className="flex items-center gap-1.5">
                  <UsersIcon />
                  محدود کردن تعداد شرکت‌کنندگان
                </span>
              </label>
              {useMaxParticipants ? (
                <input
                  type="text"
                  dir="rtl"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(toPersianNumber(digitsOnly(e.target.value)))}
                  placeholder="۵۰"
                  className={`${numberInputClass} mt-2`}
                  autoFocus
                />
              ) : (
                <p className="text-[11px] text-gray-400 mt-1.5">بدون محدودیت (نامحدود)</p>
              )}
            </div>

            <div className="hash-limit-card rounded-lg border border-gray-200 p-3">
              <label className="hash-limit-title flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useExpiry}
                  onChange={e => setUseExpiry(e.target.checked)}
                  style={{ accentColor: 'var(--c-600)' }}
                  className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                />
                <span className="flex items-center gap-1.5">
                  <ClockIcon />
                  تعیین مهلت انقضا
                </span>
              </label>
              {useExpiry ? (
                <div className="mt-2">
                  <DurationFields value={expiryDuration} onChange={setExpiryDuration} />
                </div>
              ) : (
                <p className="text-[11px] text-gray-400 mt-1.5">بدون انقضا (تا زمانی که غیرفعال شود)</p>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <HashLinksSkeleton />
      ) : links.length === 0 && surveyStatus !== 'draft' ? (
        <p className="text-sm text-gray-400 text-center py-4">هنوز لینک ناشناسی ایجاد نشده است.</p>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const url = `${baseUrl}/s/${link.token}`;
            const isCopied = copiedToken === link.token;

            return (
              <div
                key={link.id}
                className={`rounded-lg border p-3 transition-all ${
                  link.is_active
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {link.label && (
                      <p className="text-xs font-semibold text-slate-700 mb-1">{link.label}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-slate-600 font-mono bg-gray-50 border border-gray-200 rounded px-2 py-0.5 truncate max-w-[240px] sm:max-w-[320px]">
                        {url}
                      </code>
                      <button
                        onClick={() => copyLink(link.token)}
                        title="کپی لینک"
                        className={`transition-colors flex-shrink-0 p-0.5 rounded ${isCopied ? 'text-emerald-500' : 'text-gray-400 hover:text-blue-600'}`}
                      >
                        <CopyIcon copied={isCopied} />
                      </button>
                      <button
                        onClick={() => setQrLink(link)}
                        title="نمایش کد QR"
                        className="transition-colors flex-shrink-0 p-0.5 rounded text-gray-400 hover:text-blue-600"
                      >
                        <QrIcon />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        link.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        {link.is_active ? 'فعال' : 'غیرفعال'}
                      </span>
                      {link.is_expired && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          منقضی شده
                        </span>
                      )}
                      {link.is_full && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          ظرفیت تکمیل
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <UsersIcon />
                        {toPersianNumber(link.anonymous_participant_count)}
                        {link.max_participants ? ` از ${toPersianNumber(link.max_participants)}` : ''} شرکت‌کننده ناشناس
                      </span>
                      {link.expiry_value && link.expiry_unit && (
                        <span className="text-xs text-gray-500">
                          انقضا: {toPersianNumber(link.expiry_value)} {EXPIRY_UNIT_LABELS[link.expiry_unit]} پس از ایجاد
                        </span>
                      )}
                      <span className="text-xs text-gray-400 font-mono">
                        {link.token}
                      </span>
                    </div>

                    {limitsEditId === link.id ? (
                      <div className="hash-limit-editor mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white/75 p-3 shadow-sm transition-all duration-300 ease-out animate-[fadeIn_180ms_ease-out]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div className="hash-limit-card rounded-lg border border-gray-200 bg-gray-50/70 p-3 min-w-0">
                          <label className="hash-limit-title flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editUseMaxParticipants}
                              onChange={e => {
                                const checked = e.target.checked;
                                setEditUseMaxParticipants(checked);
                                if (checked && numericValue(editMaxParticipants) < link.anonymous_participant_count + 1) {
                                  setEditMaxParticipants(toPersianNumber(link.anonymous_participant_count + 1));
                                }
                              }}
                              style={{ accentColor: 'var(--c-600)' }}
                              className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                            />
                            <span className="flex items-center gap-1.5">
                              <UsersIcon />
                              محدودیت تعداد شرکت‌کنندگان
                            </span>
                          </label>
                          {editUseMaxParticipants ? (
                            <input
                              type="text"
                              dir="rtl"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={editMaxParticipants}
                              onChange={e => setEditMaxParticipants(toPersianNumber(digitsOnly(e.target.value)))}
                              placeholder={toPersianNumber(link.anonymous_participant_count + 1)}
                              className={`${numberInputClass} mt-2`}
                            />
                          ) : (
                            <p className="text-[11px] text-gray-400 mt-1.5">بدون محدودیت</p>
                          )}
                        </div>

                        <div className="hash-limit-card rounded-lg border border-gray-200 bg-gray-50/70 p-3 min-w-0">
                          <label className="hash-limit-title flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editUseExpiry}
                              onChange={e => {
                                const checked = e.target.checked;
                                setEditUseExpiry(checked);
                                const minimumHours = getMinimumExpiryHours(link.created_at);
                                if (checked && durationToHours(editExpiryDuration) < minimumHours) {
                                  setEditExpiryDuration(splitDuration(minimumHours, 'hours'));
                                }
                              }}
                              style={{ accentColor: 'var(--c-600)' }}
                              className="w-4 h-4 rounded border-gray-300 flex-shrink-0"
                            />
                            <span className="flex items-center gap-1.5">
                              <ClockIcon />
                              مهلت انقضا
                            </span>
                          </label>
                          {editUseExpiry ? (
                            <div className="mt-2">
                              <DurationFields value={editExpiryDuration} onChange={setEditExpiryDuration} />
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-400 mt-1.5">بدون انقضا</p>
                          )}
                        </div>

                        </div>

                        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                          <button
                            onClick={() => handleSaveLimits(link)}
                            disabled={savingLimitsId === link.id}
                            className="btn-primary text-xs px-3 py-1.5"
                          >
                            {savingLimitsId === link.id ? 'در حال ذخیره...' : 'ذخیره'}
                          </button>
                          <button
                            onClick={() => setLimitsEditId(null)}
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            انصراف
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <button
                          onClick={() => openLimitsEditor(link)}
                          className="text-xs text-[color:var(--c-600)] hover:underline"
                        >
                          تنظیم محدودیت‌ها
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(link)}
                      disabled={togglingId === link.id}
                      title={link.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        link.is_active
                          ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                          : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {togglingId === link.id ? '...' : link.is_active ? 'غیرفعال' : 'فعال'}
                    </button>
                    <button
                      onClick={() => handleDelete(link.id)}
                      disabled={deletingId === link.id}
                      title="حذف لینک"
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                    >
                      {deletingId === link.id ? '...' : <TrashIcon />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {links.length > 0 && (
        <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
          هر لینک به افراد بدون حساب کاربری اجازه می‌دهد در نظرسنجی شرکت کنند.
          هر مرورگر با توکن اختصاصی، یک شرکت‌کننده ناشناس جدا شمرده می‌شود.
        </p>
      )}

      <QrCodeModal
        open={!!qrLink}
        onClose={() => setQrLink(null)}
        url={qrLink ? `${baseUrl}/s/${qrLink.token}` : ''}
        label={qrLink?.label}
      />
    </div>
  );
}
