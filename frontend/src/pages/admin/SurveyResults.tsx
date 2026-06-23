import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminSurveyApi } from '../../api/endpoints';
import type { SurveyResults, PersonResult, QuestionResult } from '../../types';
import { PageLoader } from '../../components/common/index';
import { downloadBlob, getBlobErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';


const fa = (n: number, d = 0) => n.toLocaleString('fa-IR', { maximumFractionDigits: d });

function scoreColor(v: number | null) {
  if (v == null) return '#94a3b8';
  if (v < 4)    return '#ef4444';
  if (v < 7)    return '#f59e0b';
  return '#10b981';
}
function scoreBg(v: number | null) {
  if (v == null) return '#f8fafc';
  if (v < 4)    return '#fef2f2';
  if (v < 7)    return '#fffbeb';
  return '#f0fdf4';
}
function scoreGrade(v: number | null) {
  if (v == null) return '—';
  if (v < 4)    return 'ضعیف';
  if (v < 6)    return 'متوسط';
  if (v < 8)    return 'خوب';
  return 'عالی';
}


function ScorePill({ value, size = 'md' }: { value: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-sm px-2.5 py-0.5', md: 'text-base px-3 py-1', lg: 'text-2xl px-4 py-2' };
  return (
    <span className={`font-bold rounded-lg tabular-nums ${sizes[size]}`}
      style={{ background: scoreBg(value), color: scoreColor(value) }}>
      {value != null ? value.toFixed(1) : '—'}
    </span>
  );
}

function Bar({ value, max = 10, h = 6, showLabel = false }: { value: number | null; max?: number; h?: number; showLabel?: boolean }) {
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

function Avatar({ name, photo, size = 10 }: { name: string; photo: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center font-bold text-slate-400`;
  return (
    <div className={cls} style={{ width: size * 4, height: size * 4 }}>
      {photo
        ? <img src={photo} alt={name} className="w-full h-full object-cover" />
        : <span style={{ fontSize: size * 1.5 }}>{name[0]}</span>}
    </div>
  );
}

function RankMedal({ rank }: { rank: number }) {
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

function LazyComments({ surveyId, personId, questionId, total }: {
  surveyId: number; personId?: number; questionId?: number; total: number;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [resp, setResp] = useState<CommentsPage | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: number) => {
    setBusy(true);
    try {
      const r = await adminSurveyApi.comments(surveyId, { person_id: personId, question_id: questionId, page: p, page_size: 20 });
      setResp(r.data); setPage(p);
    } catch { toast.error('خطا در بارگذاری نظرات'); }
    finally { setBusy(false); }
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


function TabOverview({ results, survey }: { results: PersonResult[]; survey: any }) {
  const scored = useMemo(() => results.filter(r => r.average_score != null), [results]);
  const avg = scored.length ? scored.reduce((s, r) => s + r.average_score!, 0) / scored.length : null;
  const maxVoters = useMemo(() => Math.max(...results.map(r => r.votes_count), 0), [results]);
  const top3 = results.slice(0, 3);


  const buckets = useMemo(() => [
    { label: '۱–۳', color: '#ef4444', count: scored.filter(r => r.average_score! < 4).length },
    { label: '۴–۶', color: '#f59e0b', count: scored.filter(r => r.average_score! >= 4 && r.average_score! < 7).length },
    { label: '۷–۸', color: '#84cc16', count: scored.filter(r => r.average_score! >= 7 && r.average_score! < 9).length },
    { label: '۹–۱۰', color: '#10b981', count: scored.filter(r => r.average_score! >= 9).length },
  ], [scored]);
  const maxBucket = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="space-y-4">
      {}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'میانگین کل', value: avg != null ? avg.toFixed(1) : '—', sub: scoreGrade(avg), color: scoreColor(avg), bg: scoreBg(avg) },
          { label: 'رأی‌دهندگان', value: fa(maxVoters), sub: 'نفر شرکت‌کننده', color: '#6366f1', bg: '#eef2ff' },
          { label: 'افراد ارزیابی‌شده', value: fa(results.length), sub: `از ${survey.people_count} نفر`, color: '#0891b2', bg: '#ecfeff' },
          { label: 'بهترین امتیاز', value: results[0]?.average_score != null ? results[0].average_score.toFixed(1) : '—', sub: results[0]?.full_name ?? '—', color: '#d97706', bg: '#fffbeb' },
        ].map((c, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs text-slate-400 mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate" title={c.sub}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {}
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">توزیع امتیازات</p>
          <div className="flex items-end gap-2" style={{ height: 100 }}>
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-xs font-bold" style={{ color: b.color }}>
                  {b.count > 0 ? fa(b.count) : ''}
                </span>
                <div className="w-full rounded-t-md"
                  style={{ height: Math.max(4, (b.count / maxBucket) * 72), background: b.color, opacity: 0.85 }} />
                <span className="text-[11px] text-slate-400">{b.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
            <span>{fa(scored.length)} نفر امتیاز دارند</span>
            <span>{fa(results.length - scored.length)} نفر بدون امتیاز</span>
          </div>
        </div>

        {}
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">سکوی برتر</p>
          {top3.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">هنوز نتیجه‌ای ثبت نشده</p>
          ) : (
            <div className="space-y-3">
              {top3.map(r => (
                <div key={r.person_id} className="flex items-center gap-3">
                  <RankMedal rank={r.rank} />
                  <Avatar name={r.full_name} photo={r.photo_url} size={8} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{r.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{[r.role_title, r.department].filter(Boolean).join(' · ')}</p>
                    <Bar value={r.average_score} h={4} />
                  </div>
                  <ScorePill value={r.average_score} size="sm" />
                </div>
              ))}
              {results.length > 3 && (
                <p className="text-xs text-slate-400 text-center pt-1">و {fa(results.length - 3)} نفر دیگر در تب «نتایج فردی»</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


interface QStat {
  question_id: number;
  question_text: string;
  has_score: boolean;
  has_comment: boolean;
  avg: number | null;
  responses: number;
  comments_count: number;
}

function TabQuestions({ results, surveyId }: { results: PersonResult[]; surveyId: number }) {
  const stats = useMemo<QStat[]>(() => {
    const map = new Map<number, QStat>();
    const acc = new Map<number, { sum: number; n: number }>();

    for (const p of results) {
      for (const q of p.question_results || []) {
        if (!map.has(q.question_id)) {
          map.set(q.question_id, {
            question_id: q.question_id, question_text: q.question_text,
            has_score: q.has_score, has_comment: q.has_comment,
            avg: null, responses: 0, comments_count: 0,
          });
        }
        const s = map.get(q.question_id)!;
        s.responses      += q.responses_count;
        s.comments_count += q.comments_count ?? (q.comments?.length ?? 0);
        if (q.average_score != null && q.responses_count > 0) {
          const prev = acc.get(q.question_id) ?? { sum: 0, n: 0 };
          acc.set(q.question_id, { sum: prev.sum + q.average_score * q.responses_count, n: prev.n + q.responses_count });
        }
      }
    }
    for (const [id, { sum, n }] of acc) {
      const s = map.get(id);
      if (s && n > 0) s.avg = Math.round((sum / n) * 100) / 100;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.avg == null && b.avg == null) return 0;
      if (a.avg == null) return 1;
      if (b.avg == null) return -1;
      return b.avg - a.avg;
    });
  }, [results]);

  const maxAvg = Math.max(...stats.filter(q => q.avg != null).map(q => q.avg!), 1);

  if (!stats.length) return <p className="text-sm text-slate-400 text-center py-12">سوالی یافت نشد.</p>;

  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-slate-50">
        {stats.map((q, i) => (
          <div key={q.question_id} className="p-5">
            <div className="flex items-start gap-3">
              {}
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-400 flex-shrink-0 mt-0.5">
                {(i + 1).toLocaleString('fa-IR')}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 leading-relaxed mb-3">{q.question_text}</p>

                {q.has_score ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-slate-100">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${q.avg != null ? (q.avg / maxAvg) * 100 : 0}%`, background: scoreColor(q.avg) }} />
                    </div>
                    <span className="text-sm font-bold flex-shrink-0 w-8 text-right" style={{ color: scoreColor(q.avg) }}>
                      {q.avg != null ? q.avg.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:inline">{fa(q.responses)} پاسخ</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">سوال متنی</p>
                )}

                <LazyComments surveyId={surveyId} questionId={q.question_id} total={q.comments_count} />
              </div>

              {}
              {q.has_score && (
                <div className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center"
                  style={{ background: scoreBg(q.avg) }}>
                  <span className="text-lg font-bold leading-none" style={{ color: scoreColor(q.avg) }}>
                    {q.avg != null ? q.avg.toFixed(1) : '—'}
                  </span>
                  <span className="text-[9px] mt-0.5 font-medium" style={{ color: scoreColor(q.avg) }}>
                    {scoreGrade(q.avg)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function QuestionRow({ q, surveyId, personId }: { q: QuestionResult; surveyId: number; personId: number }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 leading-relaxed mb-1.5">{q.question_text}</p>
        {q.has_score
          ? <Bar value={q.average_score} h={4} showLabel />
          : <p className="text-xs text-slate-400">متنی</p>}
        <LazyComments surveyId={surveyId} personId={personId} questionId={q.question_id}
          total={q.comments_count ?? q.comments?.length ?? 0} />
      </div>
      {q.has_score && (
        <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-md"
          style={{ background: scoreBg(q.average_score), color: scoreColor(q.average_score) }}>
          {q.average_score != null ? q.average_score.toFixed(1) : '—'}
        </span>
      )}
    </div>
  );
}

function PersonRow({ r, surveyId, expanded, onToggle }: {
  r: PersonResult; surveyId: number; expanded: boolean; onToggle: () => void;
}) {
  const hasDetail = (r.question_results?.length ?? 0) > 0 || (r.comments_count ?? r.comments?.length ?? 0) > 0;

  return (
    <div className={`border-b border-slate-100 last:border-0 transition-colors ${expanded ? 'bg-slate-50/70' : 'hover:bg-slate-50/50'}`}>
      {}
      <button
        type="button"
        onClick={hasDetail ? onToggle : undefined}
        className={`w-full flex items-center gap-3 px-5 py-4 text-right ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <RankMedal rank={r.rank} />
        <Avatar name={r.full_name} photo={r.photo_url} size={9} />

        <div className="flex-1 min-w-0 text-right">
          <p className="text-sm font-semibold text-slate-800 truncate">{r.full_name}</p>
          <p className="text-xs text-slate-400 truncate">{[r.role_title, r.department].filter(Boolean).join(' · ')}</p>
          <div className="mt-1.5 max-w-xs">
            <Bar value={r.average_score} h={4} />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="hidden sm:block text-center">
            <p className="text-[10px] text-slate-400 mb-0.5">رأی‌دهنده</p>
            <p className="text-sm font-bold text-slate-600">{fa(r.votes_count)}</p>
          </div>
          <ScorePill value={r.average_score} size="md" />
          {hasDetail && (
            <svg className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {}
      {expanded && hasDetail && (
        <div className="px-5 pb-5">
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            {(r.question_results?.length ?? 0) > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-500 mb-1">تفکیک سوال‌به‌سوال</p>
                {r.question_results.map(q => (
                  <QuestionRow key={q.question_id} q={q} surveyId={surveyId} personId={r.person_id} />
                ))}
              </>
            )}
            {(r.comments_count ?? r.comments?.length ?? 0) > 0 && (
              <div className="mt-3">
                <LazyComments surveyId={surveyId} personId={r.person_id}
                  total={r.comments_count ?? r.comments?.length ?? 0} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabPeople({ results, surveyId }: { results: PersonResult[]; surveyId: number }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'rank' | 'name'>('rank');
  const PAGE = 50;
  const [visible, setVisible] = useState(PAGE);

  const filtered = useMemo(() => {
    let list = [...results];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.full_name.toLowerCase().includes(q) ||
        (r.department ?? '').toLowerCase().includes(q) ||
        (r.role_title ?? '').toLowerCase().includes(q)
      );
    }
    if (sort === 'name') list.sort((a, b) => a.full_name.localeCompare(b.full_name, 'fa'));
    return list;
  }, [results, search, sort]);


  useEffect(() => { setVisible(PAGE); }, [search, sort]);

  const toggle = (id: number) => setExpanded(e => e === id ? null : id);
  const shown = filtered.slice(0, visible);

  return (
    <div>
      {}
      <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-2 mb-3">
        <div className="flex-1 relative">
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام، واحد یا سمت…"
            className="w-full pr-9 pl-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 placeholder:text-slate-400" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as any)}
          className="w-full min-[420px]:w-auto text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-600">
          <option value="rank">مرتب‌سازی: رتبه</option>
          <option value="name">مرتب‌سازی: نام</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">نتیجه‌ای یافت نشد.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {shown.map(r => (
              <PersonRow key={r.person_id} r={r} surveyId={surveyId}
                expanded={expanded === r.person_id}
                onToggle={() => toggle(r.person_id)} />
            ))}
          </div>
        )}
      </div>

      {filtered.length > visible && (
        <div className="flex justify-center mt-4">
          <button type="button" onClick={() => setVisible(v => v + PAGE)}
            className="btn-secondary text-sm px-4 py-2">
            نمایش بیشتر ({fa(filtered.length - visible)} مورد دیگر)
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-center mt-4">
          نمایش {fa(Math.min(visible, filtered.length))} از {fa(filtered.length)} نفر
          {search && ` (فیلتر شده از ${fa(results.length)} نفر)`}
        </p>
      )}
    </div>
  );
}


type Tab = 'overview' | 'questions' | 'people';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'خلاصه' },
  { id: 'questions', label: 'تحلیل سوال‌ها' },
  { id: 'people',    label: 'نتایج فردی' },
];

export default function SurveyResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'excel' | 'pdf' | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const surveyId = Number(id);

  useEffect(() => {
    adminSurveyApi.results(surveyId)
      .then(r => setData(r.data))
      .catch(() => toast.error('خطا در بارگذاری نتایج'))
      .finally(() => setLoading(false));
  }, [surveyId]);

  const handleExport = async (type: 'csv' | 'excel' | 'pdf') => {
    setExporting(type);


    let downloadStarted = false;
    try {
      const r = type === 'csv'
        ? await adminSurveyApi.exportCsv(surveyId)
        : type === 'excel'
          ? await adminSurveyApi.exportExcel(surveyId)
          : await adminSurveyApi.exportPdf(surveyId);

      const blob = r.data as Blob;


      if (blob.size === 0) {
        throw new Error('فایل خروجی خالی دریافت شد. لطفاً دوباره تلاش کنید.');
      }
      const expectedType = type === 'pdf' ? 'application/pdf'
        : type === 'excel' ? 'application/vnd.openxmlformats'
        : 'text/';
      if (blob.type && !blob.type.includes(expectedType.split('/')[0] === 'text' ? 'text' : expectedType.split('/')[1])) {
        throw new Error('فایل خروجی نامعتبر است. لطفاً دوباره تلاش کنید.');
      }

      const ext = type === 'csv' ? 'csv' : type === 'excel' ? 'xlsx' : 'pdf';
      downloadBlob(blob, `results_${surveyId}.${ext}`);
      downloadStarted = true;
      toast.success('فایل دانلود شد');
    } catch (err) {
      if (!downloadStarted) {
        toast.error(await getBlobErrorMessage(err));
      }
    } finally { setExporting(null); }
  };

  if (loading) return <PageLoader />;
  if (!data)  return null;

  const { survey, results } = data;

  return (
    <div className="responsive-page max-w-4xl">
      {}
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400 mb-5">
        <Link to="/admin/surveys" className="hover:text-slate-600 transition-colors">نظرسنجی‌ها</Link>
        <span>/</span>
        <Link to={`/admin/surveys/${id}`} className="hover:text-slate-600 transition-colors truncate max-w-[160px]">{survey.title}</Link>
        <span>/</span>
        <span className="text-slate-700">نتایج</span>
      </div>

      {}
      <div className="card p-4 sm:p-5 mb-5">
        <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800 truncate">{survey.title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {survey.questions?.length ?? survey.questions_count ?? 0} سوال
              &nbsp;·&nbsp;
              {survey.people_count} فرد ارزیابی‌شونده
              &nbsp;·&nbsp;
              {results.length} نتیجه ثبت‌شده
            </p>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <button onClick={() => handleExport('pdf')} disabled={!!exporting}
              className="btn-primary text-sm flex items-center gap-1.5 px-3 py-1.5">
              {exporting === 'pdf'
                ? <div className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 12 1.5 1.5 3-3.75m-8.69-6.44A2.25 2.25 0 0 1 8.25 3h6.879a2.25 2.25 0 0 1 1.59.659l4.122 4.122a2.25 2.25 0 0 1 .659 1.591V19.5a2.25 2.25 0 0 1-2.25 2.25h-1.5" />
                  </svg>}
              {'\u06af\u0632\u0627\u0631\u0634 PDF'}
            </button>
            {(['csv', 'excel'] as const).map(type => (
              <button key={type} onClick={() => handleExport(type)} disabled={!!exporting}
                className="btn-secondary text-sm flex items-center gap-1.5 px-3 py-1.5">
                {exporting === type
                  ? <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>}
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="card py-20 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-sm text-slate-400">هنوز هیچ پاسخ کاملی ثبت نشده است</p>
        </div>
      ) : (
        <>
          {}
          <div className="flex gap-1 border-b border-slate-200 mb-5 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
                }`}>
                {t.label}
                {t.id === 'people' && (
                  <span className="mr-1.5 text-xs bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5">
                    {fa(results.length)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === 'overview'  && <TabOverview  results={results} survey={survey} />}
          {tab === 'questions' && <TabQuestions results={results} surveyId={surveyId} />}
          {tab === 'people'    && <TabPeople    results={results} surveyId={surveyId} />}

          <p className="text-xs text-slate-400 text-center mt-8">
            نتایج کاملاً ناشناس هستند — هیچ اطلاعاتی از هویت رأی‌دهندگان نمایش داده نمی‌شود
          </p>
        </>
      )}
    </div>
  );
}
