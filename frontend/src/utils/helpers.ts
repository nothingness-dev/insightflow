import { AxiosError } from 'axios';

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


  setTimeout(() => URL.revokeObjectURL(url), 250);
}


function isHtmlString(s: string): boolean {
  const trimmed = s.trimStart();
  return trimmed.startsWith('<') && /<html|<!doctype/i.test(trimmed.slice(0, 100));
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error && !(err as AxiosError).response) return err.message;
  const e = err as AxiosError;
  if (!e.response?.data) return 'خطای غیرمنتظره رخ داد';
  const d = e.response.data as any;
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


export async function getBlobErrorMessage(err: unknown): Promise<string> {
  const e = err as any;
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();


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
      
    }
    return 'خطا در تولید فایل خروجی';
  }
  return getErrorMessage(err);
}
