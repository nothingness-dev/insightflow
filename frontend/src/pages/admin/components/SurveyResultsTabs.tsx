import { useEffect, useMemo, useState } from 'react';
import type { PersonResult, QuestionResult } from '../../../types';
import { useTheme } from '../../../contexts/ThemeContext';
import { SearchInput, Select } from '../../../components/common';
import {
  Avatar,
  Bar,
  EMOJI_KEY_TO_LABEL,
  EMOJI_ORDER,
  EmojiPill,
  LazyComments,
  RankMedal,
  ScorePill,
  emojiLabelFromNumeric,
  emojiVisual,
  fa,
  scoreBg,
  scoreColor,
  scoreGrade,
} from './surveyResultsPrimitives';
export function TabOverview({ results, survey }: { results: PersonResult[]; survey: any }) {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  const scored = useMemo(() => results.filter(r => r.average_score != null), [results]);
  const avg = scored.length ? scored.reduce((s, r) => s + r.average_score!, 0) / scored.length : null;
  const maxVoters = useMemo(() => Math.max(...results.map(r => r.votes_count), 0), [results]);
  const top3 = scored.slice(0, 3);


  const buckets = useMemo(() => [
    { label: '۱–۳', color: '#ef4444', count: scored.filter(r => r.average_score! < 4).length },
    { label: '۴–۶', color: '#f59e0b', count: scored.filter(r => r.average_score! >= 4 && r.average_score! < 7).length },
    { label: '۷–۸', color: '#84cc16', count: scored.filter(r => r.average_score! >= 7 && r.average_score! < 9).length },
    { label: '۹–۱۰', color: '#10b981', count: scored.filter(r => r.average_score! >= 9).length },
  ], [scored]);
  const maxBucket = Math.max(...buckets.map(b => b.count), 1);

  const emojiBuckets = useMemo(() => {
    const totals: Record<string, number> = { bad: 0, average: 0, good: 0, excellent: 0 };
    let hasAnyEmojiQuestion = false;
    for (const r of results) {
      for (const q of r.question_results || []) {
        if (!q.has_emoji) continue;
        hasAnyEmojiQuestion = true;
        if (q.emoji_breakdown) {
          for (const key of EMOJI_ORDER) totals[key] += q.emoji_breakdown[key] ?? 0;
        }
      }
    }
    if (!hasAnyEmojiQuestion) return null;
    return EMOJI_ORDER.map(key => ({
      label: EMOJI_KEY_TO_LABEL[key],
      color: emojiVisual(EMOJI_KEY_TO_LABEL[key]).color,
      count: totals[key],
    }));
  }, [results]);
  const maxEmojiBucket = emojiBuckets ? Math.max(...emojiBuckets.map(b => b.count), 1) : 1;
  const totalEmojiResponses = emojiBuckets ? emojiBuckets.reduce((s, b) => s + b.count, 0) : 0;

  return (
    <div className="space-y-4">
<div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'میانگین کل', value: avg != null ? fa(avg, 1) : '—', sub: scoreGrade(avg), color: scoreColor(avg), bg: scoreBg(avg, dark) },
          { label: 'رأی‌دهندگان', value: fa(maxVoters), sub: 'نفر شرکت‌کننده', color: '#6366f1', bg: dark ? 'rgba(99,102,241,0.16)' : '#eef2ff' },
          { label: 'افراد ارزیابی‌شده', value: fa(results.length), sub: 'نفر', color: '#0891b2', bg: dark ? 'rgba(8,145,178,0.16)' : '#ecfeff' },
          { label: 'بهترین امتیاز', value: scored[0]?.average_score != null ? fa(scored[0].average_score, 1) : '—', sub: scored[0]?.full_name ?? '—', color: '#d97706', bg: dark ? 'rgba(217,119,6,0.16)' : '#fffbeb' },
        ].map((c, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs text-slate-400 mb-2">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate" title={c.sub}>{c.sub}</p>
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-1 ${emojiBuckets ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
<div className="card p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">توزیع امتیازات</p>
          <div className="flex items-end gap-2" style={{ minHeight: 116 }}>
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-xs font-bold leading-none" style={{ color: b.color }}>
                  {b.count > 0 ? fa(b.count) : '\u00a0'}
                </span>
                <div className="w-full rounded-t-md"
                  style={{ height: Math.max(4, (b.count / maxBucket) * 72), background: b.color, opacity: 0.85 }} />
                <span className="text-[11px] text-slate-400 leading-none">{b.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
            <span>{fa(scored.length)} نفر امتیاز دارند</span>
            <span>{fa(results.length - scored.length)} نفر بدون امتیاز</span>
          </div>
        </div>

        {emojiBuckets && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">توزیع امتیاز ایموجی</p>
            <div className="flex items-end gap-2" style={{ minHeight: 116 }}>
              {emojiBuckets.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold leading-none" style={{ color: b.color }}>
                    {b.count > 0 ? fa(b.count) : '\u00a0'}
                  </span>
                  <div className="w-full rounded-t-md"
                    style={{ height: Math.max(4, (b.count / maxEmojiBucket) * 72), background: b.color, opacity: 0.85 }} />
                  <span className="text-[11px] text-slate-400 leading-none">{b.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-3">
              <span>{fa(totalEmojiResponses)} پاسخ ایموجی ثبت شده</span>
            </div>
          </div>
        )}
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
              {scored.length > 3 && (
                <p className="text-xs text-slate-400 text-center pt-1">و {fa(scored.length - 3)} نفر دیگر در تب «نتایج فردی»</p>
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
  has_emoji: boolean;
  avg: number | null;
  responses: number;
  comments_count: number;
  emoji_avg_numeric: number | null;
  emoji_avg_label: string | null;
  emoji_responses: number;
  emoji_breakdown: Record<string, number>;
}

function computeQuestionStats(results: PersonResult[]): QStat[] {
  const map = new Map<number, QStat>();
  const acc = new Map<number, { sum: number; n: number }>();
  const emojiAcc = new Map<number, { sum: number; n: number }>();

  for (const p of results) {
    for (const q of p.question_results || []) {
      if (!map.has(q.question_id)) {
        map.set(q.question_id, {
          question_id: q.question_id, question_text: q.question_text,
          has_score: q.has_score, has_comment: q.has_comment, has_emoji: !!q.has_emoji,
          avg: null, responses: 0, comments_count: 0,
          emoji_avg_numeric: null, emoji_avg_label: null, emoji_responses: 0,
          emoji_breakdown: { bad: 0, average: 0, good: 0, excellent: 0 },
        });
      }
      const s = map.get(q.question_id)!;
      s.responses      += q.responses_count;
      s.comments_count += q.comments_count ?? (q.comments?.length ?? 0);
      if (q.average_score != null && q.responses_count > 0) {
        const prev = acc.get(q.question_id) ?? { sum: 0, n: 0 };
        acc.set(q.question_id, { sum: prev.sum + q.average_score * q.responses_count, n: prev.n + q.responses_count });
      }
      const emojiCount = q.emoji_responses_count ?? 0;
      s.emoji_responses += emojiCount;
      if (q.average_emoji_numeric != null && emojiCount > 0) {
        const prev = emojiAcc.get(q.question_id) ?? { sum: 0, n: 0 };
        emojiAcc.set(q.question_id, { sum: prev.sum + q.average_emoji_numeric * emojiCount, n: prev.n + emojiCount });
      }
      if (q.emoji_breakdown) {
        for (const key of EMOJI_ORDER) {
          s.emoji_breakdown[key] += q.emoji_breakdown[key] ?? 0;
        }
      }
    }
  }
  for (const [id, { sum, n }] of acc) {
    const s = map.get(id);
    if (s && n > 0) s.avg = Math.round((sum / n) * 100) / 100;
  }
  for (const [id, { sum, n }] of emojiAcc) {
    const s = map.get(id);
    if (s && n > 0) {
      s.emoji_avg_numeric = Math.round((sum / n) * 100) / 100;
      s.emoji_avg_label = emojiLabelFromNumeric(s.emoji_avg_numeric);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.avg == null && b.avg == null) return 0;
    if (a.avg == null) return 1;
    if (b.avg == null) return -1;
    return b.avg - a.avg;
  });
}

const SCORE_SCALE_MAX = 10;

function QuestionStatsList({ stats, surveyId }: { stats: QStat[]; surveyId: number }) {
  const { mode } = useTheme();
  const dark = mode === 'dark';

  if (!stats.length) return <p className="text-sm text-slate-400 text-center py-12">سوالی یافت نشد.</p>;

  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-slate-50">
        {stats.map((q, i) => (
          <div key={q.question_id} className="p-5">
            <div className="flex items-start gap-3">
<div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-400 flex-shrink-0 mt-0.5">
                {(i + 1).toLocaleString('fa-IR')}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 leading-relaxed mb-3">{q.question_text}</p>

                {q.has_score && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-slate-100">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${q.avg != null ? Math.min(100, (q.avg / SCORE_SCALE_MAX) * 100) : 0}%`, background: scoreColor(q.avg) }} />
                    </div>
                    <span className="text-sm font-bold flex-shrink-0 w-8 text-right" style={{ color: scoreColor(q.avg) }}>
                      {q.avg != null ? fa(q.avg, 1) : '—'}
                    </span>
                    <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:inline">{fa(q.responses)} پاسخ</span>
                  </div>
                )}

                {q.has_emoji && (
                  <div className={q.has_score ? 'mt-3' : ''}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {EMOJI_ORDER.map(key => {
                        const count = q.emoji_breakdown[key] || 0;
                        const label = EMOJI_KEY_TO_LABEL[key];
                        const { color, bg } = emojiVisual(label, dark);
                        const isTop = q.emoji_avg_label === label && count > 0;
                        return (
                          <span key={key}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                            style={{ background: bg, color, boxShadow: isTop ? `0 0 0 2px ${color}` : undefined }}>
                            {label} · {fa(count)}
                          </span>
                        );
                      })}
                      <span className="text-xs text-slate-400">{fa(q.emoji_responses)} پاسخ</span>
                    </div>
                  </div>
                )}

                {!q.has_score && !q.has_emoji && (
                  <p className="text-xs text-slate-400">سوال متنی</p>
                )}

                <LazyComments surveyId={surveyId} questionId={q.question_id} total={q.comments_count} />
              </div>
{q.has_score && (
                <div className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center"
                  style={{ background: scoreBg(q.avg, dark) }}>
                  <span className="text-lg font-bold leading-none" style={{ color: scoreColor(q.avg) }}>
                    {q.avg != null ? fa(q.avg, 1) : '—'}
                  </span>
                  <span className="text-[9px] mt-0.5 font-medium" style={{ color: scoreColor(q.avg) }}>
                    {scoreGrade(q.avg)}
                  </span>
                </div>
              )}
              {!q.has_score && q.has_emoji && (
                <div className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center"
                  style={{ background: emojiVisual(q.emoji_avg_label, dark).bg }}>
                  <span className="text-sm font-bold leading-none text-center" style={{ color: emojiVisual(q.emoji_avg_label, dark).color }}>
                    {q.emoji_avg_label || '—'}
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

export function TabQuestions({ results, surveyId }: { results: PersonResult[]; surveyId: number }) {
  const shared = useMemo(() => results.filter(r => r.result_section === 'all' || !r.result_section), [results]);
  const customGroups = useMemo(() => results.filter(r => r.result_section?.startsWith('custom:')), [results]);
  const sharedStats = useMemo(() => computeQuestionStats(shared), [shared]);

  return (
    <div className="space-y-8">
      <QuestionStatsList stats={sharedStats} surveyId={surveyId} />
      {customGroups.map(r => (
        <section key={r.person_id}>
          <h2 className="mb-3 text-sm font-bold text-amber-700 dark:text-amber-300">بخش اختصاصی: {r.full_name}</h2>
          <QuestionStatsList stats={computeQuestionStats([r])} surveyId={surveyId} />
        </section>
      ))}
    </div>
  );
}


function QuestionRow({ q, surveyId, personId }: { q: QuestionResult; surveyId: number; personId: number }) {
  const { mode } = useTheme();
  const dark = mode === 'dark';
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 leading-relaxed mb-1.5">{q.question_text}</p>
        {q.has_score && <Bar value={q.average_score} h={4} showLabel />}
        {q.has_emoji && (
          <p className={q.has_score ? 'mt-1.5' : ''}>
            <EmojiPill label={q.average_emoji_label} size="sm" />
          </p>
        )}
        {!q.has_score && !q.has_emoji && <p className="text-xs text-slate-400">متنی</p>}
        <LazyComments surveyId={surveyId} personId={personId} questionId={q.question_id}
          total={q.comments_count ?? q.comments?.length ?? 0} />
      </div>
      {q.has_score && (
        <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-md"
          style={{ background: scoreBg(q.average_score, dark), color: scoreColor(q.average_score) }}>
          {q.average_score != null ? fa(q.average_score, 1) : '—'}
        </span>
      )}
      {!q.has_score && q.has_emoji && (
        <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-md"
          style={{ background: emojiVisual(q.average_emoji_label, dark).bg, color: emojiVisual(q.average_emoji_label, dark).color }}>
          {q.average_emoji_label || '—'}
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
            {(r.question_results?.length ?? 0) === 0 &&
              (r.comments_count ?? r.comments?.length ?? 0) > 0 && (
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

export function TabPeople({ results, surveyId, showControls = true }: { results: PersonResult[]; surveyId: number; showControls?: boolean }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'rank' | 'name'>('rank');
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let list = [...results];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        (r.full_name ?? '').toLowerCase().includes(q) ||
        (r.department ?? '').toLowerCase().includes(q) ||
        (r.role_title ?? '').toLowerCase().includes(q)
      );
    }
    if (sort === 'name') list.sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'fa'));
    return list;
  }, [results, search, sort]);


  useEffect(() => {
    setPage(1);
    setExpanded(null);
  }, [search, sort]);

  const toggle = (id: number) => setExpanded(e => e === id ? null : id);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const firstVisible = filtered.length === 0 ? 0 : ((safePage - 1) * PAGE_SIZE) + 1;
  const lastVisible = Math.min(safePage * PAGE_SIZE, filtered.length);
  const shown = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div>
{showControls && (
      <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-2 mb-3">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="جستجو بر اساس نام، واحد یا سمت…" ariaLabel="جستجو در نتایج فردی" />
        </div>
        <Select
          value={sort}
          onChange={v => setSort(v as any)}
          className="w-full min-[420px]:w-auto"
          options={[
            { value: 'rank', label: 'مرتب‌سازی: رتبه' },
            { value: 'name', label: 'مرتب‌سازی: نام' },
          ]}
        />
      </div>
      )}

      {showControls && search.trim() && (
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="خلاصه فیلترهای فعال">
          <span className="text-xs font-medium text-slate-500">فیلتر فعال:</span>
          <button type="button" onClick={() => setSearch('')} className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-[color:var(--c-200)] bg-[color:var(--c-50)] px-3 text-xs font-medium text-[color:var(--c-700)] sm:min-h-9">
            <span className="max-w-48 truncate">جستجو: «{search.trim()}»</span><span aria-hidden="true">×</span>
          </button>
          <button type="button" onClick={() => setSearch('')} className="min-h-11 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-50 sm:min-h-9">پاک کردن فیلترها</button>
        </div>
      )}

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

      {showControls && filtered.length > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-3 min-[420px]:flex-row">
          <p className="text-center text-xs text-slate-500" aria-live="polite">
            نمایش {fa(firstVisible)} تا {fa(lastVisible)} از {fa(filtered.length)} نفر
            {search && ` (از ${fa(results.length)} نفر)`}
          </p>
          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 min-[420px]:w-auto">
            <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={safePage === 1} className="btn-secondary w-full !px-3 !py-1.5 disabled:opacity-40">قبلی</button>
            <span className="min-w-16 text-center text-xs font-semibold text-slate-600">{fa(safePage)} از {fa(totalPages)}</span>
            <button type="button" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={safePage === totalPages} className="btn-secondary w-full !px-3 !py-1.5 disabled:opacity-40">بعدی</button>
          </div>
        </div>
      )}
    </div>
  );
}
