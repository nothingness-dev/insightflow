import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeApi } from '../../api/endpoints';
import { EmojiRatingValue, SurveyPerson, SurveyQuestion } from '../../types';
import { PageLoader, Modal, PersonGridSkeleton, Skeleton } from '../../components/common/index';
import { formatNumber, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import { useTheme } from '../../contexts/ThemeContext';
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
  emoji_rating: EmojiRatingValue | null;
  comment: string;
};

function getQuestionTypeLabel(question: SurveyQuestion) {
  const parts: string[] = [];
  if (question.has_score) parts.push(`امتیاز ${question.score_required ? 'الزامی' : 'اختیاری'}`);
  if (question.has_emoji) parts.push(`ایموجی ${question.emoji_required ? 'الزامی' : 'اختیاری'}`);
  if (question.has_comment) parts.push(`توضیح ${question.comment_required ? 'الزامی' : 'اختیاری'}`);
  return parts.join(' + ');
}

const BadFaceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16" />
    <circle cx="8.6" cy="10" r="1.15" fill="currentColor" />
    <circle cx="15.4" cy="10" r="1.15" fill="currentColor" />
    <path d="M8.3 15.5c1-1.2 2.2-1.8 3.7-1.8s2.7.6 3.7 1.8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
  </svg>
);
const AverageFaceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16" />
    <circle cx="8.6" cy="10" r="1.15" fill="currentColor" />
    <circle cx="15.4" cy="10" r="1.15" fill="currentColor" />
    <path d="M8.3 14.8h7.4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
  </svg>
);
const GoodFaceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16" />
    <circle cx="8.6" cy="10" r="1.15" fill="currentColor" />
    <circle cx="15.4" cy="10" r="1.15" fill="currentColor" />
    <path d="M8.3 14c1 1 2.2 1.5 3.7 1.5s2.7-.5 3.7-1.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
  </svg>
);
const ExcellentFaceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16" />
    <path d="M7.7 9.6c.5-.5 1-.7 1.6-.7s1.1.2 1.6.7M13.1 9.6c.5-.5 1-.7 1.6-.7s1.1.2 1.6.7" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    <path d="M7.8 13.6c1.1 1.5 2.5 2.3 4.2 2.3s3.1-.8 4.2-2.3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
);

const EMOJI_OPTIONS: { value: EmojiRatingValue; label: string; Icon: () => JSX.Element; selectedClass: string; idleClass: string }[] = [
  { value: 'bad', label: 'ضعیف', Icon: BadFaceIcon, selectedClass: 'bg-red-500 border-red-500 text-white shadow-lg scale-105', idleClass: 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' },
  { value: 'average', label: 'متوسط', Icon: AverageFaceIcon, selectedClass: 'bg-amber-500 border-amber-500 text-white shadow-lg scale-105', idleClass: 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' },
  { value: 'good', label: 'خوب', Icon: GoodFaceIcon, selectedClass: 'bg-lime-500 border-lime-500 text-white shadow-lg scale-105', idleClass: 'bg-lime-50 border-lime-200 text-lime-700 hover:bg-lime-100' },
  { value: 'excellent', label: 'عالی', Icon: ExcellentFaceIcon, selectedClass: 'bg-emerald-500 border-emerald-500 text-white shadow-lg scale-105', idleClass: 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' },
];

function EmojiRatingPicker({ value, onChange }: { value: EmojiRatingValue | null; onChange: (v: EmojiRatingValue) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
      {EMOJI_OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-150 ${selected ? opt.selectedClass : opt.idleClass}`}
          >
            <opt.Icon />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
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
  onSubmit: (answers: { question_id: number; score?: number | null; emoji_rating?: EmojiRatingValue | null; comment?: string | null }[]) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, DraftAnswer>>({});
  const [localErrors, setLocalErrors] = useState<Record<number, string>>({});

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
    if (!person?.has_rated) {
      const incomplete = questions.some(question => {
        const answer = answers[question.id] || { score: null, emoji_rating: null, comment: '' };
        const comment = answer.comment.trim();
        const hasVal = (question.has_score && answer.score !== null) || (question.has_emoji && answer.emoji_rating !== null) || (question.has_comment && comment.length > 0);
        return !hasVal;
      });
      if (incomplete) toast.error('شما باید به همه سوالات پاسخ دهید.');
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={handleCloseAttempt} size="lg">
      <div className="p-3 sm:p-6 max-h-[88dvh] overflow-y-auto">
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
                  برای این فرد باید به همه {formatNumber(questions.length)} سوال پاسخ دهید.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              {questions.map((question, index) => {
                const answer = answers[question.id] || { score: null, emoji_rating: null, comment: '' };
                return (
              <div key={question.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3 sm:p-4">
                    <div className="mb-3">
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">
                        {formatNumber(index + 1)}. {question.text}
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
                              {formatNumber(s)}
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
                          <p className="text-xs text-gray-400 text-left mt-1">{formatNumber(answer.comment.length)}/{formatNumber(1000)}</p>
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

            <div className="flex gap-2 sm:gap-3 pt-3 pb-1 border-t border-gray-100">
              <button
                onClick={submit}
                disabled={submitting}
                className="btn-primary flex-1 min-w-0 flex items-center justify-center gap-2"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"/>}
                <span className="truncate">ثبت همه پاسخ‌ها</span>
              </button>
              <button onClick={handleCloseAttempt} className="btn-secondary flex-1 min-w-0" disabled={submitting}>انصراف</button>
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

  const handleSubmitRating = async (answers: { question_id: number; score?: number | null; emoji_rating?: EmojiRatingValue | null; comment?: string | null }[]) => {
    if (!ratingPerson) return;
    setSubmitting(true);
    try {
      await employeeApi.rate(surveyId, ratingPerson.id, answers);
      toast.success('پاسخ‌ها با موفقیت ثبت شد');
      setSurvey(s => {
        if (!s) return s;
        const updatedPeople = s.people.map(p => p.id === ratingPerson.id ? { ...p, has_rated: true } : p);
        const remaining = updatedPeople.filter(p => !p.has_rated).length;
        if (remaining > 0) {
          toast(`شما باید به ${formatNumber(remaining)} نفر دیگر پاسخ دهید.`);
        }
        return { ...s, people: updatedPeople };
      });
      setRatingPerson(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">{formatNumber(totalCount)} نفر در این نظرسنجی</p>
            {!isEnded && ratedCount > 0 && !allDone && (
              <p className="text-xs text-gray-400">{formatNumber(ratedCount)} از {formatNumber(totalCount)} نفر تکمیل شده</p>
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
        questions={ratingPerson?.questions ?? survey.questions.filter(q => !ratingPerson?.question_ids || ratingPerson.question_ids.includes(q.id))}
        onSubmit={handleSubmitRating}
        submitting={submitting}
      />
    </div>
  );
}
