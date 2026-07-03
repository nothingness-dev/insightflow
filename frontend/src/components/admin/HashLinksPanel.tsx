import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminHashLinkApi } from '../../api/endpoints';
import { SurveyHashLink } from '../../types';
import { getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
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

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
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
  const rawBase = (import.meta.env.VITE_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const baseUrl = rawBase || window.location.origin;

  const load = (signal?: AbortSignal) => {
    setLoading(true);
    adminHashLinkApi.list(surveyId, signal)
      .then(r => setLinks(r.data))
      .catch(error => {
        if (isCanceledRequest(error, signal)) return;
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

    setCreating(true);
    setLabelError('');
    try {
      const r = await adminHashLinkApi.create(surveyId, label);
      setLinks(prev => [r.data, ...prev]);
      setNewLabel('');
      setLabelError('');
      setShowCreate(false);
      toast.success('لینک ناشناس ایجاد شد');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
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
                className={`input-field w-full bg-white pr-9 ${labelError ? 'border-red-400 focus:ring-red-200' : ''}`}
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
            <p className="text-[11px] text-gray-300 font-mono">{newLabel.length}/200</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-4">در حال بارگذاری...</p>
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
                      <code className="text-xs text-slate-600 font-mono bg-white border border-gray-200 rounded px-2 py-0.5 truncate max-w-[240px] sm:max-w-[320px]">
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
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <UsersIcon />
                        {link.anonymous_participant_count} شرکت‌کننده ناشناس
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {link.token}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(link)}
                      disabled={togglingId === link.id}
                      title={link.is_active ? 'غیرفعال کردن' : 'فعال کردن'}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${
                        link.is_active
                          ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
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
