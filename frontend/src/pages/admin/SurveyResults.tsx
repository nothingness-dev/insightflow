import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminSurveyApi } from '../../api/endpoints';
import type { SurveyResults, PersonResult, QuestionResult, ResultComment } from '../../types';
import { PageLoader } from '../../components/common/index';
import { downloadBlob, getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ─── helpers ────────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold text-sm">۱</div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold text-sm">۲</div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-sm">۳</div>;
  return <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm">{rank.toLocaleString('fa-IR')}</div>;
}

function scoreColor(value: number | null): string {
  if (value === null) return '#e5e7eb';
  if (value <= 3) return '#ef4444';
  if (value <= 6) return '#f59e0b';
  return '#10b981';
}

function ScoreBar({ value, max = 10 }: { value: number | null; max?: number }) {
  const pct = value ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: scoreColor(value) }} />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-10 text-left">
        {value !== null ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
}

// ─── paginated comments ──────────────────────────────────────────────────────

const COMMENTS_PAGE_SIZE = 20;

function PaginatedComments({ comments, renderItem }: {
  comments: string[];
  renderItem: (c: string, i: number) => React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(comments.length / COMMENTS_PAGE_SIZE);
  const pageComments = comments.slice(page * COMMENTS_PAGE_SIZE, (page + 1) * COMMENTS_PAGE_SIZE);

  return (
    <div>
      <div className="space-y-2">
        {pageComments.map((c, i) => renderItem(c, page * COMMENTS_PAGE_SIZE + i))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-400">
            {(page * COMMENTS_PAGE_SIZE + 1).toLocaleString('fa-IR')}–{Math.min((page + 1) * COMMENTS_PAGE_SIZE, comments.length).toLocaleString('fa-IR')} از {comments.length.toLocaleString('fa-IR')} نظر
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded-lg border border-gray-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              قبلی
            </button>
            <span className="px-2 py-1 text-xs text-gray-500">{(page + 1).toLocaleString('fa-IR')} / {totalPages.toLocaleString('fa-IR')}</span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1 text-xs rounded-lg border border-gray-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── per-person question breakdown ───────────────────────────────────────────

function QuestionBreakdown({ questions }: { questions: QuestionResult[] }) {
  const [open, setOpen] = useState(false);
  if (!questions?.length) return null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
        تحلیل سوال‌به‌سوال
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {questions.map(question => (
            <div key={question.question_id} className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-slate-700 leading-relaxed">{question.question_text}</p>
                <span className="text-xs text-gray-400 flex-shrink-0">{question.responses_count.toLocaleString('fa-IR')} پاسخ امتیازی</span>
              </div>
              {question.has_score ? (
                <ScoreBar value={question.average_score} />
              ) : (
                <p className="text-xs text-gray-400">این سوال امتیاز عددی ندارد.</p>
              )}
              {question.comments?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">{question.comments.length.toLocaleString('fa-IR')} نظر متنی</p>
                  <PaginatedComments
                    comments={question.comments}
                    renderItem={(comment, i) => (
                      <div key={i} className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 leading-relaxed">
                        {comment}
                      </div>
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── per-person overall comments ─────────────────────────────────────────────

function CommentsSection({ comments }: { comments: ResultComment[] }) {
  const [open, setOpen] = useState(false);
  if (!comments?.length) return null;
  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
        {comments.length.toLocaleString('fa-IR')} توضیح ناشناس
        {!open && <span className="text-gray-400 font-normal">— کلیک کنید</span>}
      </button>
      {open && (
        <div className="mt-2">
          <PaginatedComments
            comments={comments.map(item => item.comment)}
            renderItem={(comment, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 leading-relaxed">
                <p className="text-[11px] font-semibold text-gray-400 mb-1">{comments[i]?.question_text}</p>
                {comment}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}

// ─── survey-level question analysis ──────────────────────────────────────────

interface SurveyQuestionStat {
  question_id: number;
  question_text: string;
  has_score: boolean;
  average_score: number | null;
  total_responses: number;
  total_comments: number;
  all_comments: string[];
}

function SurveyQuestionAnalysis({ results }: { results: PersonResult[] }) {
  const [open, setOpen] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const questionStats = useMemo<SurveyQuestionStat[]>(() => {
    const map = new Map<number, SurveyQuestionStat>();

    for (const person of results) {
      for (const q of (person.question_results || [])) {
        if (!map.has(q.question_id)) {
          map.set(q.question_id, {
            question_id: q.question_id,
            question_text: q.question_text,
            has_score: q.has_score,
            average_score: null,
            total_responses: 0,
            total_comments: 0,
            all_comments: [],
          });
        }
        const stat = map.get(q.question_id)!;
        stat.total_responses += q.responses_count;
        stat.all_comments.push(...(q.comments || []));
        stat.total_comments += (q.comments || []).length;
      }
    }

    // Compute weighted averages
    const scoreMap = new Map<number, { total: number; count: number }>();
    for (const person of results) {
      for (const q of (person.question_results || [])) {
        if (q.average_score !== null && q.responses_count > 0) {
          const prev = scoreMap.get(q.question_id) || { total: 0, count: 0 };
          scoreMap.set(q.question_id, {
            total: prev.total + q.average_score * q.responses_count,
            count: prev.count + q.responses_count,
          });
        }
      }
    }
    for (const [qid, { total, count }] of scoreMap) {
      const stat = map.get(qid);
      if (stat && count > 0) stat.average_score = Math.round((total / count) * 100) / 100;
    }

    return Array.from(map.values());
  }, [results]);

  if (!questionStats.length) return null;

  return (
    <div className="card overflow-hidden mb-5">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-6 py-4 flex items-center justify-between text-right hover:bg-gray-50 transition-colors"
      >
        <div>
          <h2 className="text-base font-semibold text-slate-800">تحلیل سوال به سوال</h2>
          <p className="text-xs text-gray-400 mt-0.5">میانگین امتیاز و نظرات برای هر سوال در کل نظرسنجی</p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="mt-4 space-y-3">
            {questionStats.map((stat, idx) => (
              <div key={stat.question_id} className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-500">
                        {(idx + 1).toLocaleString('fa-IR')}
                      </span>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed">{stat.question_text}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {stat.total_responses.toLocaleString('fa-IR')} پاسخ
                    </span>
                  </div>
                  {stat.has_score ? (
                    <ScoreBar value={stat.average_score} />
                  ) : (
                    <p className="text-xs text-gray-400">فقط متنی</p>
                  )}

                  {stat.total_comments > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setExpandedQuestion(expandedQuestion === stat.question_id ? null : stat.question_id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <svg className={`w-3.5 h-3.5 transition-transform ${expandedQuestion === stat.question_id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                        {stat.total_comments.toLocaleString('fa-IR')} نظر متنی
                      </button>
                      {expandedQuestion === stat.question_id && (
                        <div className="mt-3">
                          <PaginatedComments
                            comments={stat.all_comments}
                            renderItem={(comment, i) => (
                              <div key={i} className="bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 leading-relaxed">
                                {comment}
                              </div>
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function SurveyResults() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const surveyId = Number(id);

  useEffect(() => {
    adminSurveyApi.results(surveyId)
      .then(r => setData(r.data))
      .catch(() => toast.error('خطا در بارگذاری نتایج'))
      .finally(() => setLoading(false));
  }, [id, surveyId]);

  const handleExport = async (type: 'csv' | 'excel') => {
    setExporting(type);
    try {
      const r = type === 'csv'
        ? await adminSurveyApi.exportCsv(surveyId)
        : await adminSurveyApi.exportExcel(surveyId);
      downloadBlob(r.data as Blob, `results_${surveyId}.${type === 'csv' ? 'csv' : 'xlsx'}`);
      toast.success('فایل دانلود شد');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setExporting(null); }
  };

  if (loading) return <PageLoader />;
  if (!data) return null;

  const { survey, results } = data;
  const totalScoredAnswers = results.reduce((s, r) => s + (r.scored_answers_count || 0), 0);
  const totalVoters = results.reduce((s, r) => s + r.votes_count, 0);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/admin/surveys" className="hover:text-gray-600">نظرسنجی‌ها</Link>
        <span>/</span>
        <Link to={`/admin/surveys/${id}`} className="hover:text-gray-600">{survey.title}</Link>
        <span>/</span>
        <span className="text-gray-700">نتایج</span>
      </div>

      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 mb-1">{survey.title}</h1>
            <p className="text-gray-500 text-sm">
              {survey.questions_count || survey.questions?.length || 0} سوال برای هر فرد — {survey.people_count} فرد
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {results.length} نفر ارزیابی‌شده — {totalVoters.toLocaleString('fa-IR')} رأی‌دهنده برای افراد — {totalScoredAnswers.toLocaleString('fa-IR')} پاسخ امتیازی
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => handleExport('csv')}
              disabled={!!exporting}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {exporting === 'csv' && <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
              CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={!!exporting}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {exporting === 'excel' && <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
              Excel
            </button>
          </div>
        </div>
      </div>

      {results.length > 0 && <SurveyQuestionAnalysis results={results} />}

      {results.length === 0 ? (
        <div className="card py-16 text-center text-gray-400">
          <p>هنوز پاسخی ثبت نشده است</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r: PersonResult) => (
            <div
              key={r.person_id}
              className={`card p-5 ${r.rank === 1 ? 'border-amber-200 ring-1 ring-amber-100' : ''}`}
            >
              <div className="flex items-center gap-4">
                <RankBadge rank={r.rank} />

                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  {r.photo_url ? (
                    <img src={r.photo_url} alt={r.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                      {r.full_name[0]}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{r.full_name}</p>
                  <p className="text-xs text-gray-400">{[r.role_title, r.department].filter(Boolean).join(' — ')}</p>
                  <div className="mt-2">
                    <ScoreBar value={r.average_score} />
                  </div>
                </div>

                <div className="flex gap-5 flex-shrink-0 text-center hidden sm:flex">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">میانگین</p>
                    <p className="text-lg font-bold" style={{ color: scoreColor(r.average_score) }}>
                      {r.average_score !== null ? r.average_score.toFixed(1) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">رأی‌دهنده</p>
                    <p className="text-lg font-bold text-slate-700">{r.votes_count.toLocaleString('fa-IR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">پاسخ امتیازی</p>
                    <p className="text-lg font-bold text-slate-700">{(r.scored_answers_count || 0).toLocaleString('fa-IR')}</p>
                  </div>
                </div>
              </div>

              <QuestionBreakdown questions={r.question_results || []} />
              <CommentsSection comments={r.comments || []} />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">
        نتایج کاملاً ناشناس هستند — هیچ اطلاعاتی از هویت رأی‌دهندگان نمایش داده نمی‌شود
      </p>
    </div>
  );
}
