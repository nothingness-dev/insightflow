import axios from 'axios';

export function isCanceledRequest(error: unknown, signal?: AbortSignal) {
  const err = error as { code?: string; name?: string; message?: string } | null;
  const message = String(err?.message || '').toLowerCase();
  return (
    signal?.aborted ||
    axios.isCancel(error) ||
    err?.code === 'ERR_CANCELED' ||
    err?.name === 'CanceledError' ||
    err?.name === 'AbortError' ||
    message.includes('canceled') ||
    message.includes('cancelled') ||
    message.includes('aborted')
  );
}
