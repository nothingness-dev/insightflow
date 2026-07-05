import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminHashLinkApi } from '../../api/endpoints';
import { HashLinkLock, SurveyHashLink } from '../../types';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import { Modal } from '../common';

interface Props {
  link: SurveyHashLink | null;
  onClose: () => void;
  onUnlocked: (linkId: number) => void;
}

export default function HashLinkLocksModal({ link, onClose, onUnlocked }: Props) {
  const [locks, setLocks] = useState<HashLinkLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);

  useEffect(() => {
    if (!link) return;
    const controller = new AbortController();
    setLoading(true);
    adminHashLinkApi.listLocks(link.id, controller.signal)
      .then(r => setLocks(r.data))
      .catch(error => {
        if (isCanceledRequest(error, controller.signal)) return;
        toast.error('خطا در بارگذاری قفل‌های IP');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [link?.id]);

  const handleUnlock = async (lockId: number) => {
    if (!link) return;
    if (!window.confirm('آیا مطمئن هستید که می‌خواهید قفل این آدرس IP را باز کنید؟ این کار به همان دستگاه/شبکه اجازه می‌دهد دوباره شرکت کند.')) return;

    setUnlockingId(lockId);
    try {
      await adminHashLinkApi.unlock(link.id, lockId);
      setLocks(prev => prev.filter(l => l.id !== lockId));
      toast.success('قفل IP باز شد');
      onUnlocked(link.id);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUnlockingId(null);
    }
  };

  return (
    <Modal open={!!link} onClose={onClose} title="آدرس‌های IP قفل‌شده" size="md">
      <div className="p-5 sm:p-6">
        {link && (
          <p className="text-xs text-gray-400 mb-4">
            لینک: <span className="font-mono">{link.label || link.token}</span> — هر آدرس IP که در این لیست باشد
            دیگر نمی‌تواند در این نظرسنجی از طریق این لینک شرکت کند، مگر اینکه قفل آن باز شود.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">در حال بارگذاری...</p>
        ) : locks.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">هیچ آدرس IP قفل‌شده‌ای برای این لینک وجود ندارد.</p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {locks.map(lock => (
              <div key={lock.id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-mono font-semibold text-slate-700">{lock.ip_address}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(lock.completed_at)}</p>
                </div>
                <button
                  onClick={() => handleUnlock(lock.id)}
                  disabled={unlockingId === lock.id}
                  className="text-xs px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors flex-shrink-0"
                >
                  {unlockingId === lock.id ? '...' : 'باز کردن قفل'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm px-4">بستن</button>
        </div>
      </div>
    </Modal>
  );
}
