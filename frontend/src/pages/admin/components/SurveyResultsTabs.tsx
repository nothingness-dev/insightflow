import { useEffect, useMemo, useState } from 'react';
import type { PersonResult, QuestionResult } from '../../../types';
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

      <div className={`grid grid-cols-1 ${emojiBuckets ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
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

        {emojiBuckets && (
          <div className="card p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">توزیع امتیاز ایموجی</p>
            <div className="flex items-end gap-2" style={{ height: 100 }}>
              {emojiBuckets.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs font-bold" style={{ color: b.color }}>
                    {b.count > 0 ? fa(b.count) : ''}
                  </span>
                  <div className="w-full rounded-t-md"
                    style={{ height: Math.max(4, (b.count / maxEmojiBucket) * 72), background: b.color, opacity: 0.85 }} />
                  <span className="text-[11px] text-slate-400">{b.label}</span>
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
  has_emoji: boolean;
  avg: number | null;
  responses: number;
  comments_count: number;
  emoji_avg_numeric: number | null;
  emoji_avg_label: string | null;
  emoji_responses: number;
  emoji_breakdown: Record<string, number>;
}

export function TabQuestions({ results, surveyId }: { results: PersonResult[]; surveyId: number }) {
  const stats = useMemo<QStat[]>(() => {
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
  }, [results]);

  const maxAvg = Math.max(...stats.filter(q => q.avg != null).map(q => q.avg!), 1);

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
                        style={{ width: `${q.avg != null ? (q.avg / maxAvg) * 100 : 0}%`, background: scoreColor(q.avg) }} />
                    </div>
                    <span className="text-sm font-bold flex-shrink-0 w-8 text-right" style={{ color: scoreColor(q.avg) }}>
                      {q.avg != null ? q.avg.toFixed(1) : '—'}
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
                        const { color, bg } = emojiVisual(label);
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
                  style={{ background: scoreBg(q.avg) }}>
                  <span className="text-lg font-bold leading-none" style={{ color: scoreColor(q.avg) }}>
                    {q.avg != null ? q.avg.toFixed(1) : '—'}
                  </span>
                  <span className="text-[9px] mt-0.5 font-medium" style={{ color: scoreColor(q.avg) }}>
                    {scoreGrade(q.avg)}
                  </span>
                </div>
              )}
              {!q.has_score && q.has_emoji && (
                <div className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center"
                  style={{ background: emojiVisual(q.emoji_avg_label).bg }}>
                  <span className="text-sm font-bold leading-none text-center" style={{ color: emojiVisual(q.emoji_avg_label).color }}>
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


function QuestionRow({ q, surveyId, personId }: { q: QuestionResult; surveyId: number; personId: number }) {
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
          style={{ background: scoreBg(q.average_score), color: scoreColor(q.average_score) }}>
          {q.average_score != null ? q.average_score.toFixed(1) : '—'}
        </span>
      )}
      {!q.has_score && q.has_emoji && (
        <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-md"
          style={{ background: emojiVisual(q.average_emoji_label).bg, color: emojiVisual(q.average_emoji_label).color }}>
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

export function TabPeople({ results, surveyId }: { results: PersonResult[]; surveyId: number }) {
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

