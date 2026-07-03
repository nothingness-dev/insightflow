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

  return (
    <Modal open={open} onClose={onClose} title="کد QR لینک" size="sm">
      <div className="flex flex-col items-center gap-4 py-2">
        {label && <p className="text-sm font-medium text-slate-700 text-center">{label}</p>}

        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <canvas ref={canvasRef} width={QR_SIZE} height={QR_SIZE} className={ready ? '' : 'opacity-0'} />
          {!ready && !error && (
            <div
              style={{ width: QR_SIZE, height: QR_SIZE }}
              className="flex items-center justify-center text-xs text-gray-400"
            >
              در حال ساخت کد QR...
            </div>
          )}
          {error && (
            <div style={{ width: QR_SIZE, height: QR_SIZE }} className="flex items-center justify-center text-xs text-red-500">
              {error}
            </div>
          )}
        </div>

        <code className="text-xs text-slate-500 font-mono bg-gray-50 border border-gray-100 rounded px-2 py-1 max-w-full truncate">
          {url}
        </code>

        <div className="flex gap-2 w-full">
          <button onClick={handleDownload} disabled={!ready} className="btn-primary flex-1 text-sm">
            دانلود PNG
          </button>
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">
            بستن
          </button>
        </div>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          این کد به‌صورت محلی در مرورگر شما ساخته می‌شود و به هیچ سروری ارسال نمی‌گردد.
        </p>
      </div>
    </Modal>
  );
}
