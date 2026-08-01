import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Modal } from '../common';

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  label?: string;
}

const QR_SIZE = 280;

export default function QrCodeModal({ open, onClose, url, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || !url) return;

    setReady(false);
    setError('');

    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(canvas, url, {
      width: QR_SIZE,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then(() => setReady(true))
      .catch(() => setError('خطا در ساخت کد QR'));
  }, [open, url]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const link = document.createElement('a');
      link.download = `qr-${(label || 'link').trim().replace(/\s+/g, '-') || 'link'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      toast.error('دانلود کد QR ناموفق بود');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('لینک کپی شد');
    } catch {
      toast.error('کپی لینک ناموفق بود');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="کد QR لینک"
      size="sm"
      bodyClassName="p-4 sm:p-6"
      footer={(
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:gap-3">
          <button type="button" onClick={handleDownload} disabled={!ready} className="btn-primary text-sm">
            دانلود PNG
          </button>
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            بستن
          </button>
        </div>
      )}
    >
      <div>
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-gray-100 bg-[color:var(--c-50)] text-[color:var(--c-700)]">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h4.5v4.5h-4.5v-4.5ZM15.75 4.5h4.5v4.5h-4.5v-4.5ZM3.75 15h4.5v4.5h-4.5V15ZM14.25 14.25h2.25v2.25h-2.25v-2.25ZM18 14.25h2.25v2.25H18v-2.25ZM14.25 18h2.25v2.25h-2.25V18ZM18 18h2.25v2.25H18V18Z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {label || 'لینک ناشناس'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            برای مشارکت سریع، کد را اسکن کنید یا لینک را کپی کنید.
          </p>
        </div>

        <div className="mx-auto w-full max-w-[19rem] rounded-2xl border border-gray-100 bg-gray-50 p-2 shadow-sm">
          <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <canvas ref={canvasRef} width={QR_SIZE} height={QR_SIZE} className={`${ready ? 'block' : 'hidden'} h-auto w-full`} />
            {!ready && !error && (
              <div className="flex aspect-square w-full items-center justify-center text-xs text-gray-400">
                در حال ساخت کد QR...
              </div>
            )}
            {error && (
              <div className="flex aspect-square w-full items-center justify-center text-xs text-red-500">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex w-full items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-left text-xs text-slate-500 font-mono" dir="ltr">
            {url}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-[color:var(--c-700)]"
            aria-label="کپی لینک"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 8h9.75A2.25 2.25 0 0 1 20 10.25V18a2.25 2.25 0 0 1-2.25 2.25H10A2.25 2.25 0 0 1 7.75 18V8.25A.25.25 0 0 1 8 8Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 15.75h-.5A2.25 2.25 0 0 1 2.5 13.5V5A2.25 2.25 0 0 1 4.75 2.75h8.5A2.25 2.25 0 0 1 15.5 5v.5" />
            </svg>
          </button>
        </div>

        <p className="mt-4 text-[11px] text-gray-400 text-center leading-relaxed">
          این کد به‌صورت محلی در مرورگر شما ساخته می‌شود و به هیچ سروری ارسال نمی‌گردد.
        </p>
      </div>
    </Modal>
  );
}
