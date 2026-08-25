import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeApi } from '../../api/endpoints';
import { EmojiRatingValue, SurveyPerson, SurveyQuestion } from '../../types';
import { Modal, ModalErrorSummary, PersonGridSkeleton, Skeleton } from '../../components/common/index';
import ParticipationProgress from '../../components/common/ParticipationProgress';
import { formatNumber, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import { useTheme } from '../../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { D, E, fadeUp, useMotionDisabled } from '../../motion';
import toast from 'react-hot-toast';
import EmojiRatingPicker, { getQuestionTypeLabel } from '../../components/common/RatingControls';

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
  emoji_rating: EmojiRatingValue | null;
  comment: string;
};

function PersonCard({ person, onRate, disabled, rowRef, highlight }: {
  person: SurveyPerson & { has_rated: boolean };
  onRate: () => void;
  disabled?: boolean;
  rowRef?: (element: HTMLDivElement | null) => void;
  highlight?: boolean;
}) {
  const reduced = useMotionDisabled();
  return (
    <motion.div
      ref={rowRef}
      data-testid={`employee-participant-card-${person.id}`}
      variants={fadeUp}
      initial={reduced ? undefined : 'hidden'}
      animate={reduced ? undefined : 'visible'}
      transition={reduced ? undefined : { duration: D.normal / 1000, ease: E.standard }}
      className={`person-card group flex h-full flex-col ${highlight ? 'ring-2 ring-[color:var(--c-300)] ring-offset-2' : ''} ${person.has_rated || disabled ? '!cursor-default' : ''}`}
    >
      {person.photo_url && (
      <div className="relative" data-testid={`employee-participant-media-${person.id}`}>
        <div className="aspect-[4/3] w-full overflow-hidden bg-[color:var(--c-50)] dark:bg-gray-700">
          <img src={person.photo_url} alt="" className="h-full w-full object-cover" />
        </div>
        {person.has_rated && (
          <div role="img" aria-label="ثبت شده" className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 shadow-md ring-2 ring-white">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        )}
      </div>
      )}

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="flex min-w-0 items-center gap-2.5" data-testid={`employee-participant-identity-${person.id}`}>
          {!person.photo_url && (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[color:var(--c-50)] text-xl font-bold text-[color:var(--c-500)] ring-1 ring-[color:var(--c-100)]" aria-hidden="true">
              {person.full_name[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-snug text-slate-800">{person.full_name}</h3>
            {(person.role_title || person.department) && (
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {[person.role_title, person.department].filter(Boolean).join(' — ')}
              </p>
            )}
          </div>
          {person.has_rated && !person.photo_url && (
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-label="ثبت شده">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </span>
          )}
        </div>
        {person.description && (
          <p className="mt-2 line-clamp-2 min-h-0 text-xs leading-relaxed text-gray-500">{person.description}</p>
        )}

        <div className="mt-auto pt-3">
          {person.has_rated ? (
            <div className="w-full min-h-11 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold text-center border border-emerald-200 flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              ثبت شد
            </div>
          ) : disabled ? (
            <div className="w-full min-h-11 rounded-lg bg-gray-50 text-gray-400 text-xs font-medium text-center border border-gray-200 flex items-center justify-center">
              پایان یافته
            </div>
          ) : (
            <button
              type="button"
              onClick={onRate}
              data-testid={`employee-rating-trigger-${person.id}`}
              className="w-full min-h-11 rounded-lg bg-[color:var(--c-600)] hover:bg-[color:var(--c-700)] active:bg-purple-800 text-white text-xs font-semibold transition-all duration-150 shadow-sm hover:shadow-md"
            >
              پاسخ به سوال‌ها
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RatingModal({ open, onClose, person, questions, onSubmit, submitting, submitError }: {
  open: boolean;
  onClose: (hasIncompleteAnswers: boolean) => void;
  person: (SurveyPerson & { has_rated: boolean }) | null;
  questions: SurveyQuestion[];
  onSubmit: (answers: { question_id: number; score?: number | null; emoji_rating?: EmojiRatingValue | null; comment?: string | null }[]) => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const [answers, setAnswers] = useState<Record<number, DraftAnswer>>({});
  const [localErrors, setLocalErrors] = useState<Record<number, string>>({});
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const initial: Record<number, DraftAnswer> = {};
    questions.forEach(question => {
      initial[question.id] = { score: null, emoji_rating: null, comment: '' };
    });
    setAnswers(initial);
    setLocalErrors({});
  }, [open, questions]);

  const getColor = (s: number, selected: boolean) => {
    if (selected) {
      if (s <= 3) return 'bg-red-500 border-red-500 text-white ring-2 ring-red-200 ring-offset-1';
      if (s <= 6) return 'bg-amber-500 border-amber-500 text-white ring-2 ring-amber-200 ring-offset-1';
      return 'bg-emerald-500 border-emerald-500 text-white ring-2 ring-emerald-200 ring-offset-1';
    }
    if (s <= 3) return 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100';
    if (s <= 6) return 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100';
    return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100';
  };

  const updateAnswer = (questionId: number, patch: Partial<DraftAnswer>) => {
    setAnswers(current => ({
      ...current,
      [questionId]: {
        ...(current[questionId] || { score: null, emoji_rating: null, comment: '' }),
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
      const answer = answers[question.id] || { score: null, emoji_rating: null, comment: '' };
      const comment = answer.comment.trim();
      const hasScoreValue = question.has_score && answer.score !== null;
      const hasEmojiValue = question.has_emoji && answer.emoji_rating !== null;
      const hasCommentValue = question.has_comment && comment.length > 0;

      if (question.has_score && question.score_required && answer.score === null) {
        nextErrors[question.id] = 'انتخاب امتیاز برای این سوال الزامی است.';
        continue;
      }
      if (question.has_emoji && question.emoji_required && answer.emoji_rating === null) {
        nextErrors[question.id] = 'انتخاب امتیاز ایموجی برای این سوال الزامی است.';
        continue;
      }
      if (question.has_comment && question.comment_required && !comment) {
        nextErrors[question.id] = 'نوشتن توضیح برای این سوال الزامی است.';
        continue;
      }
      if (!hasScoreValue && !hasEmojiValue && !hasCommentValue) {
        nextErrors[question.id] = 'این سوال نباید خالی بماند.';
      }
    }
    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
    return Object.keys(nextErrors).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    onSubmit(questions.map(question => ({
      question_id: question.id,
      score: question.has_score ? answers[question.id]?.score ?? null : null,
      emoji_rating: question.has_emoji ? answers[question.id]?.emoji_rating ?? null : null,
      comment: question.has_comment ? answers[question.id]?.comment?.trim() || null : null,
    })));
  };

  const handleCloseAttempt = () => {
    if (submitting) return;
    const incomplete = !person?.has_rated && questions.some(question => {
      const answer = answers[question.id] || { score: null, emoji_rating: null, comment: '' };
      const comment = answer.comment.trim();
      const hasVal = (question.has_score && answer.score !== null) || (question.has_emoji && answer.emoji_rating !== null) || (question.has_comment && comment.length > 0);
      return !hasVal;
    });
    onClose(incomplete);
  };

  return (
    <Modal
      open={open}
      onClose={handleCloseAttempt}
      title={person ? `پاسخ به سوال‌ها · ${person.full_name}` : 'پاسخ به سوال‌ها'}
      size="lg"
      dismissible={!submitting}
      busy={submitting}
      bodyClassName="p-3 sm:p-6"
      testId="employee-rating-modal"
      footer={person ? (
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="btn-primary min-w-0 flex items-center justify-center gap-2"
          >
            {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" aria-hidden="true"/>}
            <span className="truncate" aria-live="polite">{submitting ? 'در حال ثبت پاسخ‌ها…' : 'ثبت همه پاسخ‌ها'}</span>
          </button>
          <button type="button" onClick={handleCloseAttempt} className="btn-secondary min-w-0" disabled={submitting}>انصراف</button>
        </div>
      ) : null}
    >
      <div>
        {person && (
          <>
            <ModalErrorSummary
              ref={errorSummaryRef}
              errors={Object.values(localErrors)}
              className="mb-4"
            />
            {submitError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert" data-testid="employee-submit-error">
                <p className="font-semibold">پاسخ‌ها ثبت نشد</p>
                <p className="mt-1 text-xs leading-relaxed">پاسخ‌های واردشده حفظ شده‌اند. اتصال را بررسی کنید و دوباره تلاش کنید.</p>
                <p className="mt-1 text-xs text-red-600">{submitError}</p>
              </div>
            )}
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
                  برای این فرد باید به همه {formatNumber(questions.length)} سوال پاسخ دهید.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              {questions.map((question, index) => {
                const answer = answers[question.id] || { score: null, emoji_rating: null, comment: '' };
                return (
                  <section
                    key={question.id}
                    id={`employee-rating-question-${question.id}`}
                    aria-labelledby={`employee-rating-question-${question.id}-label`}
                    aria-describedby={[
                      question.help_text ? `employee-rating-question-${question.id}-help` : '',
                      localErrors[question.id] ? `employee-rating-question-${question.id}-error` : '',
                    ].filter(Boolean).join(' ') || undefined}
                    className="rounded-xl border border-gray-200 border-s-[3px] bg-gray-50/70 p-3 sm:p-4"
                    style={{ borderInlineStartColor: 'var(--c-300)' }}
                  >
                    <div className="mb-3 flex items-start gap-2.5">
                      <span className="flex h-6 min-w-6 flex-shrink-0 items-center justify-center rounded-md bg-[color:var(--c-100)] px-1 text-xs font-bold text-[color:var(--c-700)]" aria-hidden="true">
                        {formatNumber(index + 1)}
                      </span>
                      <div className="min-w-0">
                        <p id={`employee-rating-question-${question.id}-label`} className="text-sm font-bold leading-relaxed text-slate-800">
                          {question.text}
                        </p>
                        {question.help_text && <p id={`employee-rating-question-${question.id}-help`} className="mt-1 text-xs text-gray-500">{question.help_text}</p>}
                        <p className="mt-1 text-[11px] text-gray-500">{getQuestionTypeLabel(question)}</p>
                      </div>
                    </div>

                    {question.has_score && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">
                          امتیاز ۱ تا ۱۰ {question.score_required ? <span className="text-red-500">*</span> : <span className="text-gray-400">(اختیاری)</span>}
                        </p>
                        <div className="rating-score-grid grid gap-1.5 sm:gap-2">
                          {[1,2,3,4,5,6,7,8,9,10].map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateAnswer(question.id, { score: s })}
                              aria-pressed={answer.score === s}
                              aria-label={`امتیاز ${formatNumber(s)} از ۱۰`}
                              className={`relative min-h-11 rounded-xl border-2 px-1 py-2.5 text-sm font-bold transition-[background-color,border-color,color,box-shadow] duration-150 ${getColor(s, answer.score === s)}`}
                            >
                              <span className="flex items-center justify-center gap-1">
                                {formatNumber(s)}
                                {answer.score === s && (
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {question.has_emoji && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">
                          امتیاز کیفی {question.emoji_required ? <span className="text-red-500">*</span> : <span className="text-gray-400">(اختیاری)</span>}
                        </p>
                        <EmojiRatingPicker
                          value={answer.emoji_rating}
                          onChange={v => updateAnswer(question.id, { emoji_rating: v })}
                        />
                      </div>
                    )}

                    {question.has_comment && (
                      <div>
                        <label htmlFor={`employee-rating-comment-${question.id}`} className="block text-xs font-medium text-gray-500 mb-1.5">
                          توضیحات {question.comment_required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(اختیاری)</span>}
                        </label>
                        <textarea
                          id={`employee-rating-comment-${question.id}`}
                          value={answer.comment}
                          onChange={e => updateAnswer(question.id, { comment: e.target.value })}
                          rows={3}
                          maxLength={1000}
                          placeholder="نظر یا توضیح خود را بنویسید..."
                          aria-invalid={!!localErrors[question.id] || undefined}
                          aria-describedby={[
                            question.help_text ? `employee-rating-question-${question.id}-help` : '',
                            localErrors[question.id] ? `employee-rating-question-${question.id}-error` : '',
                          ].filter(Boolean).join(' ') || undefined}
                          className="input-field w-full resize-none rounded-xl leading-relaxed"
                        />
                        {answer.comment.length > 0 && (
                          <p className="text-xs text-gray-400 text-left mt-1">{formatNumber(answer.comment.length)}/{formatNumber(1000)}</p>
                        )}
                      </div>
                    )}

                    {localErrors[question.id] && (
                      <p id={`employee-rating-question-${question.id}-error`} role="alert" className="text-xs text-red-500 mt-2">{localErrors[question.id]}</p>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function EmployeeSurveyDetail() {
  const { mode } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<SurveyDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingPerson, setRatingPerson] = useState<(SurveyPerson & { has_rated: boolean }) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [closeNotice, setCloseNotice] = useState<{ incomplete: boolean; remaining: number } | null>(null);
  const [focusPersonId, setFocusPersonId] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const surveyId = Number(id);

  const load = useCallback((signal?: AbortSignal) => {
    employeeApi.survey(surveyId, signal)
      .then(r => setSurvey(r.data))
      .catch(error => {
        if (isCanceledRequest(error, signal)) return;
        toast.error('خطا در بارگذاری نظرسنجی');
      })
      .finally(() => {
        if (!signal?.aborted) setLoading(false);
      });
  }, [surveyId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!closeNotice) return;
    const messages: string[] = [];
    if (closeNotice.incomplete) messages.push('شما باید به تمام سوالات پاسخ دهید.');
    if (closeNotice.remaining > 0) {
      messages.push(`شما باید به ${formatNumber(closeNotice.remaining)} نفر باقی‌مانده پاسخ دهید.`);
    }
    if (messages.length > 0) {
      toast.error(messages.join(' '), {
        id: 'employee-survey-close-warning',
        duration: 5000,
      });
    }
    setCloseNotice(null);
  }, [closeNotice]);

  const handleCloseRatingModal = (incomplete: boolean) => {
    const remaining = survey?.people.filter(person => !person.has_rated).length ?? 0;
    setRatingPerson(null);
    setSubmitError(null);
    setCloseNotice({ incomplete, remaining });
  };

  const openRatingModal = (person: SurveyPerson & { has_rated: boolean }) => {
    setSubmitError(null);
    setRatingPerson(person);
  };

  const handleSubmitRating = async (answers: { question_id: number; score?: number | null; emoji_rating?: EmojiRatingValue | null; comment?: string | null }[]) => {
    if (!ratingPerson) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await employeeApi.rate(surveyId, ratingPerson.id, answers);
      toast.success('پاسخ‌ها با موفقیت ثبت شد');
      const completedPersonId = ratingPerson.id;
      const updatedPeople = (survey?.people ?? []).map(person => (
        person.id === completedPersonId ? { ...person, has_rated: true } : person
      ));
      const remaining = updatedPeople.filter(person => !person.has_rated).length;
      const nextPerson = updatedPeople.find(person => !person.has_rated);
      setSurvey(current => current ? { ...current, people: updatedPeople } : current);
      setFocusPersonId(nextPerson?.id ?? null);
      if (remaining > 0) {
        toast(`شما باید به ${formatNumber(remaining)} نفر دیگر پاسخ دهید.`);
      }
      setRatingPerson(null);
    } catch (err) {
      const message = getErrorMessage(err);
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (focusPersonId == null) return;
    const element = rowRefs.current.get(focusPersonId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => {
        element.querySelector<HTMLButtonElement>('[data-testid^="employee-rating-trigger-"]')?.focus({ preventScroll: true });
      }, 350);
    }
    const timeout = window.setTimeout(() => setFocusPersonId(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [focusPersonId]);

  if (loading) return (
    <div className="responsive-page">
      <div className="card p-4 sm:p-6 mb-6 space-y-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
      <PersonGridSkeleton items={8} />
    </div>
  );
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
  const allDone = ratedCount === totalCount && totalCount > 0;

  return (
    <div className={`responsive-page ${!closed && !allDone ? 'has-sticky-bottom-action' : ''}`}>
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
              : { backgroundColor: mode === 'dark' ? 'rgba(16,185,129,0.16)' : '#ecfdf5', color: mode === 'dark' ? '#6ee7b7' : '#065f46', borderColor: mode === 'dark' ? 'rgba(16,185,129,0.35)' : '#a7f3d0' }}>
            {closed ? 'بسته شده' : 'فعال'}
          </span>
        </div>

        {survey.description && (
          <p className="text-sm text-gray-400 leading-relaxed border-t border-gray-100 pt-3 mt-3">{survey.description}</p>
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
          <div className="mb-4">
            <ParticipationProgress completed={ratedCount} total={totalCount} testId="employee-participation-progress" />
          </div>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {survey.people.map(person => (
              <PersonCard
                key={person.id}
                person={person}
                rowRef={element => { if (element) rowRefs.current.set(person.id, element); else rowRefs.current.delete(person.id); }}
                highlight={focusPersonId === person.id}
                onRate={() => !isEnded && openRatingModal(person)}
                disabled={isEnded}
              />
            ))}
          </div>
          {!isEnded && !allDone && (
            <div className="participation-sticky-action safe-bottom-action sticky z-20 mt-4" data-testid="employee-sticky-next">
              <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    const nextPerson = survey.people.find(person => !person.has_rated);
                    if (nextPerson) openRatingModal(nextPerson);
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--c-600)] px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--c-700)] active:bg-purple-800"
                >
                  <span>ادامه با نفر بعدی</span>
                  <span className="max-w-[42%] truncate text-xs text-white/90">({survey.people.find(person => !person.has_rated)?.full_name})</span>
                </button>
              </div>
            </div>
          )}
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
        onClose={handleCloseRatingModal}
        person={ratingPerson}
        questions={ratingPerson?.questions ?? survey.questions.filter(q => !ratingPerson?.question_ids || ratingPerson.question_ids.includes(q.id))}
        onSubmit={handleSubmitRating}
        submitting={submitting}
        submitError={submitError}
      />
    </div>
  );
}
