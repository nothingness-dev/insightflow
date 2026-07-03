import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { adminSurveyApi } from '../../../api/endpoints';
import { isCanceledRequest } from '../../../utils/http';

export const fa = (n: number, d = 0) => n.toLocaleString('fa-IR', { maximumFractionDigits: d });

export function scoreColor(v: number | null) {
  if (v == null) return '#94a3b8';
  if (v < 4) return '#ef4444';
  if (v < 7) return '#f59e0b';
  return '#10b981';
}

export function scoreBg(v: number | null) {
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

const EMOJI_VISUALS: Record<string, { color: string; bg: string }> = {
  'بد': { color: '#ef4444', bg: '#fef2f2' },
  'متوسط': { color: '#f59e0b', bg: '#fffbeb' },
  'خوب': { color: '#84cc16', bg: '#f7fee7' },
  'عالی': { color: '#10b981', bg: '#f0fdf4' },
};

export function emojiVisual(label?: string | null) {
  return (label && EMOJI_VISUALS[label]) || { color: '#94a3b8', bg: '#f8fafc' };
}

export function emojiLabelFromNumeric(value: number | null): string | null {
  if (value == null) return null;
  return EMOJI_NUM_TO_LABEL[Math.round(value)] ?? null;
}

export function EmojiPill({ label, size = 'md' }: { label?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-sm px-2.5 py-0.5', md: 'text-base px-3 py-1', lg: 'text-xl px-4 py-2' };
  const { color, bg } = emojiVisual(label);
  return (
    <span className={`font-bold rounded-lg ${sizes[size]}`} style={{ background: bg, color }}>
      {label || '—'}
    </span>
  );
}

export function ScorePill({ value, size = 'md' }: { value: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-sm px-2.5 py-0.5', md: 'text-base px-3 py-1', lg: 'text-2xl px-4 py-2' };
  return (
    <span className={`font-bold rounded-lg tabular-nums ${sizes[size]}`}
      style={{ background: scoreBg(value), color: scoreColor(value) }}>
      {value != null ? value.toFixed(1) : '—'}
    </span>
  );
}

export function Bar({ value, max = 10, h = 6, showLabel = false }: { value: number | null; max?: number; h?: number; showLabel?: boolean }) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 w-full">
      <div className="flex-1 rounded-full overflow-hidden bg-slate-100" style={{ height: h }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: scoreColor(value) }} />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold w-7 text-right tabular-nums flex-shrink-0"
          style={{ color: scoreColor(value) }}>
          {value != null ? value.toFixed(1) : '—'}
        </span>
      )}
    </div>
  );
}

export function Avatar({ name, photo, size = 10 }: { name: string; photo: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center font-bold text-slate-400`;
  return (
    <div className={cls} style={{ width: size * 4, height: size * 4 }}>
      {photo
        ? <img src={photo} alt={name} className="w-full h-full object-cover" />
        : <span style={{ fontSize: size * 1.5 }}>{name[0]}</span>}
    </div>
  );
}

export function RankMedal({ rank }: { rank: number }) {
  const style =
    rank === 1 ? { background: '#fbbf24', color: '#fff' } :
    rank === 2 ? { background: '#94a3b8', color: '#fff' } :
    rank === 3 ? { background: '#b45309', color: '#fff' } :
               { background: '#f1f5f9', color: '#64748b' };
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={style}>
      {rank.toLocaleString('fa-IR')}
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
      setResp(r.data); setPage(p);
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
