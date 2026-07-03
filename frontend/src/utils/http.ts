import axios from 'axios';

export function isCanceledRequest(error: unknown, signal?: AbortSignal) {
  return signal?.aborted || axios.isCancel(error) || (error as { code?: string } | null)?.code === 'ERR_CANCELED';
}
