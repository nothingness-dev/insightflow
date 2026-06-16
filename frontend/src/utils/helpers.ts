export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fa-IR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('fa-IR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getErrorMessage(err: unknown): string {
  const e = err as any;
  if (!e?.response?.data) return 'خطای غیرمنتظره رخ داد';
  const d = e.response.data;
  if (typeof d === 'string') return d;
  if (d.detail) return d.detail;
  const msgs: string[] = [];
  for (const key of Object.keys(d)) {
    const val = d[key];
    if (Array.isArray(val)) msgs.push(...val);
    else if (typeof val === 'string') msgs.push(val);
  }
  return msgs.join(' — ') || 'خطای نامشخص';
}
