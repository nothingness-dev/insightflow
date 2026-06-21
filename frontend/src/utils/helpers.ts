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
  document.body.removeChild(a);
  // Delay revocation: revoking the URL synchronously right after a.click() can
  // cause the browser to fire an error event (and trigger the catch block) even
  // though the file actually downloaded. 250 ms gives the browser time to
  // initiate the download before the blob URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 250);
}

/** Returns true if a string looks like an HTML document (e.g. a nginx error page). */
function isHtmlString(s: string): boolean {
  const trimmed = s.trimStart();
  return trimmed.startsWith('<') && /<html|<!doctype/i.test(trimmed.slice(0, 100));
}

export function getErrorMessage(err: unknown): string {
  const e = err as any;
  if (e instanceof Error && e.message && !e?.response) return e.message;
  if (!e?.response?.data) return 'خطای غیرمنتظره رخ داد';
  const d = e.response.data;
  if (typeof d === 'string') {
    if (isHtmlString(d)) return 'سرور در دسترس نیست. لطفاً دوباره تلاش کنید.';
    return d;
  }
  if (d.detail) return d.detail;
  const msgs: string[] = [];
  for (const key of Object.keys(d)) {
    const val = d[key];
    if (Array.isArray(val)) msgs.push(...val);
    else if (typeof val === 'string') msgs.push(val);
  }
  return msgs.join(' — ') || 'خطای نامشخص';
}

/**
 * Like getErrorMessage, but also reads error bodies that arrive as a Blob.
 * When a request uses `responseType: 'blob'` (file downloads), axios delivers
 * the JSON error body as a Blob, so the synchronous getErrorMessage cannot read
 * it. This resolves the real backend message (e.g. "خروجی PDF در دسترس نیست").
 */
export async function getBlobErrorMessage(err: unknown): Promise<string> {
  const e = err as any;
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      // If the blob is an HTML page (e.g. a 502/504 nginx error page) there is
      // no meaningful error to surface — show a friendly server-unavailable message.
      if (isHtmlString(text)) return 'سرور در دسترس نیست. لطفاً دوباره تلاش کنید.';
      try {
        const json = JSON.parse(text);
        if (typeof json === 'string') return json;
        if (json.detail) return json.detail;
        const msgs: string[] = [];
        for (const key of Object.keys(json)) {
          const val = json[key];
          if (Array.isArray(val)) msgs.push(...val);
          else if (typeof val === 'string') msgs.push(val);
        }
        if (msgs.length) return msgs.join(' — ');
      } catch {
        if (text && text.length < 300) return text;
      }
    } catch {
      /* fall through */
    }
    return 'خطا در تولید فایل خروجی';
  }
  return getErrorMessage(err);
}
