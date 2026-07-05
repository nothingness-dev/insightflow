import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { adminSurveyApi } from '../../../api/endpoints';
import { isCanceledRequest } from '../../../utils/http';
import { useTheme } from '../../../contexts/ThemeContext';

export const fa = (n: number | null | undefined, d = 0) =>
  Number.isFinite(n) ? Number(n).toLocaleString('fa-IR', { maximumFractionDigits: d }) : '۰';

export function scoreColor(v: number | null) {
  if (v == null) return '#94a3b8';
  if (v < 4) return '#ef4444';
  if (v < 7) return '#f59e0b';
  return '#10b981';
}

export function scoreBg(v: number | null, dark = false) {
  if (dark) {
    if (v == null) return 'rgba(148,163,184,0.14)';
    if (v < 4) return 'rgba(239,68,68,0.16)';
    if (v < 7) return 'rgba(245,158,11,0.16)';
    return 'rgba(16,185,129,0.16)';
  }
  if (v == null) return '#f8fafc';
  if (v < 4) return '#fef2f2';
  if (v < 7) return '#fffbeb';
  return '#f0fdf4';
}

export function scoreGrade(v: number | null) {
  if (v == null) return '—';
  if (v < 4) return 'ضعیف';
  if (v < 6) return 'متوسط';
  if (v < 8) return 'خوب';
  return 'عالی';
}

export const EMOJI_ORDER = ['bad', 'average', 'good', 'excellent'] as const;
export const EMOJI_KEY_TO_LABEL: Record<string, string> = { bad: 'بد', average: 'متوسط', good: 'خوب', excellent: 'عالی' };
export const EMOJI_NUM_TO_LABEL: Record<number, string> = { 1: 'بد', 2: 'متوسط', 3: 'خوب', 4: 'عالی' };

const EMOJI_VISUALS: Record<string, { color: string; bg: string; darkBg: string }> = {
  'بد': { color: '#ef4444', bg: '#fef2f2', darkBg: 'rgba(239,68,68,0.16)' },
  'متوسط': { color: '#f59e0b', bg: '#fffbeb', darkBg: 'rgba(245,158,11,0.16)' },
  'خوب': { color: '#84cc16', bg: '#f7fee7', darkBg: 'rgba(132,204,22,0.16)' },
  'عالی': { color: '#10b981', bg: '#f0fdf4', darkBg: 'rgba(16,185,129,0.16)' },
};

export function emojiVisual(label?: string | null, dark = false) {
  const visual = (label && EMOJI_VISUALS[label]) || { color: '#94a3b8', bg: '#f8fafc', darkBg: 'rgba(148,163,184,0.14)' };
  return { color: visual.color, bg: dark ? visual.darkBg : visual.bg };
}

export function emojiLabelFromNumeric(value: number | null): string | null {
  if (value == null) return null;
  return EMOJI_NUM_TO_LABEL[Math.round(value)] ?? null;
}

export function EmojiPill({ label, size = 'md' }: { label?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const { mode } = useTheme();
  const sizes = { sm: 'text-sm px-2.5 py-0.5', md: 'text-base px-3 py-1', lg: 'text-xl px-4 py-2' };
  const { color, bg } = emojiVisual(label, mode === 'dark');
  return (
    <span className={`font-bold rounded-lg ${sizes[size]}`} style={{ background: bg, color }}>
      {label || '—'}
    </span>
  );
}

export function ScorePill({ value, size = 'md' }: { value: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const { mode } = useTheme();
  const sizes = { sm: 'text-sm px-2.5 py-0.5', md: 'text-base px-3 py-1', lg: 'text-2xl px-4 py-2' };
  return (
    <span className={`font-bold rounded-lg tabular-nums ${sizes[size]}`}
      style={{ background: scoreBg(value, mode === 'dark'), color: scoreColor(value) }}>
      {value != null ? fa(value, 1) : '—'}
    </span>
  );
}

export function Bar({ value, max = 10, h = 6, showLabel = false }: { value: number | null; max?: number; h?: number; showLabel?: boolean }) {
  const safeMax = max > 0 ? max : 10;
  const pct = value != null ? Math.min(100, (value / safeMax) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 w-full">
      <div className="flex-1 rounded-full overflow-hidden bg-slate-100" style={{ height: h }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: scoreColor(value) }} />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold w-7 text-right tabular-nums flex-shrink-0"
          style={{ color: scoreColor(value) }}>
          {value != null ? fa(value, 1) : '—'}
        </span>
      )}
    </div>
  );
}

export function Avatar({ name, photo, size = 10 }: { name: string; photo: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center font-bold text-slate-400`;
  const displayName = name || '؟';
  return (
    <div className={cls} style={{ width: size * 4, height: size * 4 }}>
      {photo
        ? <img src={photo} alt={displayName} className="w-full h-full object-cover" />
        : <span style={{ fontSize: size * 1.5 }}>{displayName[0]}</span>}
    </div>
  );
}

export function RankMedal({ rank }: { rank: number }) {
  const { mode } = useTheme();
  const safeRank = Number.isFinite(rank) ? rank : 0;
  const style =
    safeRank === 1 ? { background: '#fbbf24', color: '#fff' } :
    safeRank === 2 ? { background: '#94a3b8', color: '#fff' } :
    safeRank === 3 ? { background: '#b45309', color: '#fff' } :
    mode === 'dark' ? { background: 'rgba(148,163,184,0.18)', color: '#94a3b8' } :
               { background: '#f1f5f9', color: '#64748b' };
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={style}>
      {safeRank > 0 ? safeRank.toLocaleString('fa-IR') : '—'}
    </div>
  );
}

interface CommentRow { comment: string; question_text: string; }
interface CommentsPage { total: number; page: number; page_size: number; total_pages: number; comments: CommentRow[]; }

export function LazyComments({ surveyId, personId, questionId, total }: {
  surveyId: number; personId?: number; questionId?: number; total: number;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [resp, setResp] = useState<CommentsPage | null>(null);
  const [busy, setBusy] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const load = useCallback(async (p: number) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    try {
      const r = await adminSurveyApi.comments(
        surveyId,
        { person_id: personId, question_id: questionId, page: p, page_size: 20 },
        controller.signal,
      );
      setResp({
        ...r.data,
        total: Number.isFinite(r.data?.total) ? r.data.total : 0,
        page: Number.isFinite(r.data?.page) ? r.data.page : p,
        page_size: Number.isFinite(r.data?.page_size) ? r.data.page_size : 20,
        total_pages: Number.isFinite(r.data?.total_pages) ? r.data.total_pages : 1,
        comments: Array.isArray(r.data?.comments) ? r.data.comments : [],
      });
      setPage(p);
    } catch (error) {
      if (isCanceledRequest(error, controller.signal)) return;
      toast.error('خطا در بارگذاری نظرات');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [surveyId, personId, questionId]);

  if (total === 0) return null;

  return (
    <div>
      <button type="button" onClick={() => { if (!open && !resp) load(1); setOpen(o => !o); }}
        className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors mt-2">
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {fa(total)} نظر متنی
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {busy && !resp && <div className="py-3 flex justify-center"><div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" /></div>}
          {resp && <>
            {resp.comments.map((c, i) => (
              <div key={i} className="text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 leading-relaxed">{c.comment}</div>
            ))}
            {resp.total_pages > 1 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">{fa((page - 1) * 20 + 1)}–{fa(Math.min(page * 20, resp.total))} از {fa(resp.total)}</span>
                <div className="flex gap-1">
                  <button type="button" disabled={page === 1 || busy} onClick={() => load(page - 1)}
                    className="px-2 py-0.5 text-xs rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50">قبلی</button>
                  <span className="px-1.5 py-0.5 text-xs text-slate-400">{fa(page)}/{fa(resp.total_pages)}</span>
                  <button type="button" disabled={page === resp.total_pages || busy} onClick={() => load(page + 1)}
                    className="px-2 py-0.5 text-xs rounded border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50">بعدی</button>
                </div>
              </div>
            )}
          </>}
        </div>
      )}
    </div>
  );
}
