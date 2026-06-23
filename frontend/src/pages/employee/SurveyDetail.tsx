import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeApi } from '../../api/endpoints';
import { SurveyPerson, SurveyQuestion } from '../../types';
import { PageLoader, Modal } from '../../components/common/index';
import { getErrorMessage } from '../../utils/helpers';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

interface SurveyDetailData {
  id: number;
  title: string;
  question: string;
  description: string;
  status: string;
  is_active: boolean;
  questions: SurveyQuestion[];
  people: (SurveyPerson & { has_rated: boolean })[];
}

type DraftAnswer = {
  score: number | null;
  comment: string;
};

function getQuestionTypeLabel(question: SurveyQuestion) {
  const parts: string[] = [];
  if (question.has_score) parts.push(`امتیاز ${question.score_required ? 'الزامی' : 'اختیاری'}`);
  if (question.has_comment) parts.push(`توضیح ${question.comment_required ? 'الزامی' : 'اختیاری'}`);
  return parts.join(' + ');
}

function PersonCard({ person, onRate, disabled }: {
  person: SurveyPerson & { has_rated: boolean };
  onRate: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="person-card group">
      <div className="relative">
        <div className="w-full aspect-square bg-[color:var(--c-50)] overflow-hidden">
          {person.photo_url ? (
            <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[color:var(--c-300)] text-5xl font-bold">
              {person.full_name[0]}
            </div>
          )}
        </div>
        {person.has_rated && (
          <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-md">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-slate-800 text-sm leading-snug">{person.full_name}</h3>
        {(person.role_title || person.department) && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {[person.role_title, person.department].filter(Boolean).join(' — ')}
          </p>
        )}
        {person.description && (
          <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">{person.description}</p>
        )}

        <div className="mt-3">
          {person.has_rated ? (
            <div className="w-full py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold text-center border border-emerald-200 flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              ثبت شد
            </div>
          ) : disabled ? (
            <div className="w-full py-2 rounded-lg bg-gray-50 text-gray-400 text-xs font-medium text-center border border-gray-200">
              پایان یافته
            </div>
          ) : (
            <button
              onClick={onRate}
              className="w-full py-2 rounded-lg bg-[color:var(--c-600)] hover:bg-[color:var(--c-700)] active:bg-purple-800 text-white text-xs font-semibold transition-all duration-150 shadow-sm hover:shadow-md"
            >
              پاسخ به سوال‌ها
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RatingModal({ open, onClose, person, questions, onSubmit, submitting }: {
  open: boolean;
  onClose: () => void;
  person: (SurveyPerson & { has_rated: boolean }) | null;
  questions: SurveyQuestion[];
  onSubmit: (answers: { question_id: number; score?: number | null; comment?: string | null }[]) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, DraftAnswer>>({});
  const [localErrors, setLocalErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open) return;
    const initial: Record<number, DraftAnswer> = {};
    questions.forEach(question => {
      initial[question.id] = { score: null, comment: '' };
    });
    setAnswers(initial);
    setLocalErrors({});
  }, [open, questions]);

  const getColor = (s: number, selected: boolean) => {
    if (selected) {
      if (s <= 3) return 'bg-red-500 border-red-500 text-white shadow-lg scale-105';
      if (s <= 6) return 'bg-amber-500 border-amber-500 text-white shadow-lg scale-105';
      return 'bg-emerald-500 border-emerald-500 text-white shadow-lg scale-105';
    }
    if (s <= 3) return 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100';
    if (s <= 6) return 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100';
    return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100';
  };

  const updateAnswer = (questionId: number, patch: Partial<DraftAnswer>) => {
    setAnswers(current => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || { score: null, comment: '' }),
        ...patch,
      },
    }));
    setLocalErrors(current => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  };

  const validate = () => {
    const nextErrors: Record<number, string> = {};
    for (const question of questions) {
      const answer = answers[question.id] || { score: null, comment: '' };
      const comment = answer.comment.trim();
      const hasScoreValue = question.has_score && answer.score !== null;
      const hasCommentValue = question.has_comment && comment.length > 0;

      if (question.has_score && question.score_required && answer.score === null) {
        nextErrors[question.id] = 'انتخاب امتیاز برای این سوال الزامی است.';
        continue;
      }
      if (question.has_comment && question.comment_required && !comment) {
        nextErrors[question.id] = 'نوشتن توضیح برای این سوال الزامی است.';
        continue;
      }
      if (!hasScoreValue && !hasCommentValue) {
        nextErrors[question.id] = 'این سوال نباید خالی بماند.';
      }
    }
    setLocalErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    onSubmit(questions.map(question => ({
      question_id: question.id,
      score: question.has_score ? answers[question.id]?.score ?? null : null,
      comment: question.has_comment ? answers[question.id]?.comment?.trim() || null : null,
    })));
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="p-4 sm:p-6 max-h-[85dvh] overflow-y-auto">
        {person && (
          <>
            <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3 sm:gap-4 mb-5 pb-5 border-b border-gray-100">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[color:var(--c-100)] flex-shrink-0 shadow-sm">
                {person.photo_url ? (
                  <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[color:var(--c-400)] text-2xl font-bold">
                    {person.full_name[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-base">{person.full_name}</p>
                <p className="text-sm text-gray-400">{[person.role_title, person.department].filter(Boolean).join(' — ')}</p>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  برای این فرد باید به همه {questions.length} سوال پاسخ دهید.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              {questions.map((question, index) => {
                const answer = answers[question.id] || { score: null, comment: '' };
                return (
                  <div key={question.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-3">
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">
                        {index + 1}. {question.text}
                      </p>
                      {question.help_text && <p className="text-xs text-gray-400 mt-1">{question.help_text}</p>}
                      <p className="text-[11px] text-gray-400 mt-1">{getQuestionTypeLabel(question)}</p>
                    </div>

                    {question.has_score && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">
                          امتیاز ۱ تا ۱۰ {question.score_required ? <span className="text-red-500">*</span> : <span className="text-gray-400">(اختیاری)</span>}
                        </p>
                        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                          {[1,2,3,4,5,6,7,8,9,10].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateAnswer(question.id, { score: s })}
                              className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${getColor(s, answer.score === s)}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {question.has_comment && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          توضیحات {question.comment_required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(اختیاری)</span>}
                        </label>
                        <textarea
                          value={answer.comment}
                          onChange={e => updateAnswer(question.id, { comment: e.target.value })}
                          rows={3}
                          maxLength={1000}
                          placeholder="نظر یا توضیح خود را بنویسید..."
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--c-400)] focus:border-transparent resize-none placeholder-gray-300 leading-relaxed bg-white"
                        />
                        {answer.comment.length > 0 && (
                          <p className="text-xs text-gray-400 text-left mt-1">{answer.comment.length}/۱۰۰۰</p>
                        )}
                      </div>
                    )}

                    {localErrors[question.id] && (
                      <p className="text-xs text-red-500 mt-2">{localErrors[question.id]}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 sticky bottom-0 bg-white pt-3 border-t border-gray-100">
              <button
                onClick={submit}
                disabled={submitting}
                className="btn-primary w-full sm:flex-1 flex items-center justify-center gap-2"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                ثبت همه پاسخ‌ها
              </button>
              <button onClick={onClose} className="btn-secondary w-full sm:w-auto" disabled={submitting}>انصراف</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function EmployeeSurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<SurveyDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingPerson, setRatingPerson] = useState<(SurveyPerson & { has_rated: boolean }) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const surveyId = Number(id);

  const load = useCallback(() => {
    employeeApi.survey(surveyId)
      .then(r => setSurvey(r.data))
      .catch(() => toast.error('خطا در بارگذاری نظرسنجی'))
      .finally(() => setLoading(false));
  }, [surveyId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmitRating = async (answers: { question_id: number; score?: number | null; comment?: string | null }[]) => {
    if (!ratingPerson) return;
    setSubmitting(true);
    try {
      await employeeApi.rate(surveyId, ratingPerson.id, answers);
      toast.success('پاسخ‌ها با موفقیت ثبت شد ✓');
      setSurvey(s => s ? {
        ...s,
        people: s.people.map(p => p.id === ratingPerson.id ? { ...p, has_rated: true } : p)
      } : s);
      setRatingPerson(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader/>;
  if (!survey) return (
    <div className="text-center py-20">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
      <p className="text-gray-500 font-medium">نظرسنجی یافت نشد</p>
      <button onClick={() => navigate('/surveys')} className="btn-primary mt-4">بازگشت به لیست</button>
    </div>
  );

  const ratedCount = survey.people.filter(p => p.has_rated).length;
  const totalCount = survey.people.length;
  const questionCount = survey.questions.length;
  const closed = survey.status === 'closed';
  const isEnded = closed;
  const pct = totalCount > 0 ? Math.round((ratedCount / totalCount) * 100) : 0;
  const allDone = ratedCount === totalCount && totalCount > 0;

  return (
    <div className="responsive-page">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/surveys')}
          className="flex items-center gap-2 text-sm text-gray-500 transition-colors bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm hover:border-[color:var(--c-300)] hover:text-[color:var(--c-700)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          بازگشت
        </button>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="text-gray-700 font-medium truncate">{survey.title}</span>
        </div>
      </div>

      {closed && (
        <div className="mb-5 flex items-center gap-3 rounded-xl px-5 py-3 border" style={{ backgroundColor: 'var(--c-50)', borderColor: 'var(--c-200)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--c-700)' }}>این نظرسنجی بسته شده است</p>
        </div>
      )}
      {allDone && !isEnded && (
        <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
          <p className="text-sm font-medium text-emerald-700">شما در تمام بخش‌های این نظرسنجی شرکت کرده‌اید</p>
        </div>
      )}

      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between gap-3 sm:gap-4 mb-4">
          <h1 className="text-xl font-bold text-slate-800 leading-snug">{survey.title}</h1>
          <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border"
            style={closed
              ? { backgroundColor: 'var(--c-50)', color: 'var(--c-700)', borderColor: 'var(--c-200)' }
              : { backgroundColor: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
            {closed ? 'بسته شده' : 'فعال'}
          </span>
        </div>

        <p className="text-gray-600 leading-relaxed">برای هر فرد باید به {questionCount} سوال پاسخ دهید.</p>
        {survey.description && (
          <p className="text-sm text-gray-400 leading-relaxed border-t border-gray-100 pt-3 mt-3">{survey.description}</p>
        )}

        {questionCount > 0 && (
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">سوال‌ها</p>
            <ol className="space-y-2 text-sm text-slate-700 list-decimal pr-5">
              {survey.questions.map(question => (
                <li key={question.id}>
                  {question.text}
                  <span className="mr-2 text-[11px] text-gray-400">({getQuestionTypeLabel(question)})</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {totalCount > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>پیشرفت پاسخ‌دهی</span>
              <span className="font-semibold" style={{ color: 'var(--c-700)' }}>{ratedCount} از {totalCount} نفر — {pct}٪</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: allDone ? '#10b981' : 'var(--c-500)' }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}
      </div>

      {survey.people.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm">هنوز فردی به این نظرسنجی اضافه نشده است</p>
        </div>
      ) : questionCount === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 text-sm">این نظرسنجی سوال فعالی ندارد</p>
        </div>
      ) : (
        <>
          {!isEnded && !allDone && (
            <div className="mb-4 flex items-start gap-3 rounded-xl px-4 py-3 border text-sm"
              style={{ backgroundColor: 'var(--c-50)', borderColor: 'var(--c-200)', color: 'var(--c-700)' }}>
              <span>برای هر یک از <strong>{totalCount} نفر</strong> باید به <strong>{questionCount} سوال</strong> پاسخ دهید. هیچ سوالی نباید خالی بماند.
                {ratedCount > 0 && <span className="mr-1">({totalCount - ratedCount} نفر باقی‌مانده)</span>}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">{totalCount} نفر در این نظرسنجی</p>
            {!isEnded && ratedCount > 0 && !allDone && (
              <p className="text-xs text-gray-400">{ratedCount} از {totalCount} نفر تکمیل شده</p>
            )}
          </div>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {survey.people.map(person => (
              <PersonCard
                key={person.id}
                person={person}
                onRate={() => !isEnded && setRatingPerson(person)}
                disabled={isEnded}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3">
        <button
          onClick={() => navigate('/surveys')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[color:var(--c-700)] transition-colors"
        >
          بازگشت به لیست نظرسنجی‌ها
        </button>
        {allDone && (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">تکمیل شد</span>
        )}
      </div>

      <RatingModal
        open={!!ratingPerson}
        onClose={() => setRatingPerson(null)}
        person={ratingPerson}
        questions={survey.questions}
        onSubmit={handleSubmitRating}
        submitting={submitting}
      />
    </div>
  );
}
