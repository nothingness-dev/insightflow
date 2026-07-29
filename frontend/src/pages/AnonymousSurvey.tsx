
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { anonymousApi } from '../api/endpoints';
import { EmojiRatingValue, SurveyPerson, SurveyQuestion } from '../types';
import { Modal, AnonymousSurveySkeleton } from '../components/common/index';
import ThemeSwitcher from '../components/common/ThemeSwitcher';
import CopyrightNotice from '../components/common/CopyrightNotice';
import VersionBadge from '../components/common/VersionBadge';
import { formatNumber, getErrorMessage } from '../utils/helpers';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { D, E, fadeUp, useMotionDisabled } from '../motion';
import toast from 'react-hot-toast';
function getOrCreateAnonToken(surveyToken: string): string {
  const key = `anon_session_${surveyToken}`;
  let token = localStorage.getItem(key);
  if (!token) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    token = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(key, token);
  }
  return token;
}

interface SurveyData {
  id: number;
  title: string;
  question: string;
  description: string;
  status: string;
  is_active: boolean;
  questions: SurveyQuestion[];
  people: (SurveyPerson & { has_rated?: boolean })[];
}

type DraftAnswer = { score: number | null; emoji_rating: EmojiRatingValue | null; comment: string };

function getQuestionTypeLabel(q: SurveyQuestion) {
  const parts: string[] = [];
  if (q.has_score) parts.push(`امتیاز ${q.score_required ? 'الزامی' : 'اختیاری'}`);
  if (q.has_emoji) parts.push(`ایموجی ${q.emoji_required ? 'الزامی' : 'اختیاری'}`);
  if (q.has_comment) parts.push(`توضیح ${q.comment_required ? 'الزامی' : 'اختیاری'}`);
  return parts.join(' + ');
}
const BadFaceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16"/>
    <circle cx="8.6" cy="10" r="1.15" fill="currentColor"/>
    <circle cx="15.4" cy="10" r="1.15" fill="currentColor"/>
    <path d="M8.3 15.5c1-1.2 2.2-1.8 3.7-1.8s2.7.6 3.7 1.8" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
  </svg>
);
const AverageFaceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16"/>
    <circle cx="8.6" cy="10" r="1.15" fill="currentColor"/>
    <circle cx="15.4" cy="10" r="1.15" fill="currentColor"/>
    <path d="M8.3 14.8h7.4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
  </svg>
);
const GoodFaceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16"/>
    <circle cx="8.6" cy="10" r="1.15" fill="currentColor"/>
    <circle cx="15.4" cy="10" r="1.15" fill="currentColor"/>
    <path d="M8.3 14c1 1 2.2 1.5 3.7 1.5s2.7-.5 3.7-1.5" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
  </svg>
);
const ExcellentFaceIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-8 sm:h-8" fill="none">
    <circle cx="12" cy="12" r="9.25" fill="currentColor" opacity="0.16"/>
    <path d="M7.7 9.6c.5-.5 1-.7 1.6-.7s1.1.2 1.6.7M13.1 9.6c.5-.5 1-.7 1.6-.7s1.1.2 1.6.7" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"/>
    <path d="M7.8 13.6c1.1 1.5 2.5 2.3 4.2 2.3s3.1-.8 4.2-2.3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"/>
  </svg>
);
const EMOJI_OPTIONS = [
  { value: 'bad' as EmojiRatingValue, label: 'ضعیف', Icon: BadFaceIcon, selectedClass: 'bg-red-500 border-red-500 text-white shadow-lg scale-105', idleClass: 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' },
  { value: 'average' as EmojiRatingValue, label: 'متوسط', Icon: AverageFaceIcon, selectedClass: 'bg-amber-500 border-amber-500 text-white shadow-lg scale-105', idleClass: 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' },
  { value: 'good' as EmojiRatingValue, label: 'خوب', Icon: GoodFaceIcon, selectedClass: 'bg-lime-500 border-lime-500 text-white shadow-lg scale-105', idleClass: 'bg-lime-50 border-lime-200 text-lime-700 hover:bg-lime-100' },
  { value: 'excellent' as EmojiRatingValue, label: 'عالی', Icon: ExcellentFaceIcon, selectedClass: 'bg-emerald-500 border-emerald-500 text-white shadow-lg scale-105', idleClass: 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' },
];

function EmojiPicker({ value, onChange }: { value: EmojiRatingValue | null; onChange: (v: EmojiRatingValue) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
      {EMOJI_OPTIONS.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all duration-150 ${value === opt.value ? opt.selectedClass : opt.idleClass}`}>
          <opt.Icon/>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type PersonStatus = 'completed' | 'not_answered' | 'needs_completion';

function personStatus(person: SurveyPerson & { has_rated?: boolean }, disabled?: boolean): PersonStatus {
  if (person.has_rated) return 'completed';
  if (disabled) return 'needs_completion';
  return 'not_answered';
}

const STATUS_META: Record<PersonStatus, { label: string; className: string }> = {
  completed:        { label: 'تکمیل شده',      className: 'text-emerald-600' },
  not_answered:     { label: 'پاسخ داده نشده', className: 'text-gray-400' },
  needs_completion: { label: 'نیازمند تکمیل',  className: 'text-amber-600' },
};

const AnonymousPersonCard = ({ person, onRate, disabled, rowRef, highlight }: {
  person: SurveyPerson & { has_rated?: boolean };
  onRate: () => void;
  disabled?: boolean;
  rowRef?: (el: HTMLDivElement | null) => void;
  highlight?: boolean;
}) => {
  const status = personStatus(person, disabled);
  const meta = STATUS_META[status];
  const done = status === 'completed';
  const reduced = useMotionDisabled();

  return (
    <motion.div
      ref={rowRef}
      variants={fadeUp}
      initial={reduced ? undefined : 'hidden'}
      animate={reduced ? undefined : 'visible'}
      transition={reduced ? undefined : { duration: D.normal / 1000, ease: E.standard }}
      className={`person-card group flex h-full flex-col ${
        highlight
          ? 'ring-2 ring-[color:var(--c-300)] ring-offset-2'
          : ''
      } ${done || disabled ? '!cursor-default' : ''}`}
    >
      <div className="relative">
        <div className="w-full aspect-[16/9] bg-[color:var(--c-50)] dark:bg-gray-700 overflow-hidden">
          {person.photo_url
            ? <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover"/>
            : <div className="w-full h-full flex items-center justify-center text-[color:var(--c-300)] text-4xl font-bold">{person.full_name[0]}</div>
          }
        </div>
        {done && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shadow-md ring-2 ring-white">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <h3 className="font-semibold text-slate-800 text-sm leading-snug truncate">{person.full_name}</h3>
        {(person.role_title || person.department) && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{[person.role_title, person.department].filter(Boolean).join(' — ')}</p>
        )}
        {person.description && (
          <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">{person.description}</p>
        )}

        <div className="mt-auto pt-3">
          {done ? (
            <div className="w-full min-h-10 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold text-center border border-emerald-200 flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              {meta.label}
            </div>
          ) : disabled ? (
            <div className={`w-full min-h-10 rounded-lg bg-gray-50 text-xs font-medium text-center border border-gray-200 flex items-center justify-center ${meta.className}`}>
              {meta.label}
            </div>
          ) : (
            <button
              onClick={onRate}
              className="w-full min-h-10 rounded-lg bg-[color:var(--c-600)] hover:bg-[color:var(--c-700)] active:bg-purple-800 text-white text-xs font-semibold transition-all duration-150 shadow-sm hover:shadow-md"
            >
              پاسخ به سوال‌ها
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

function RatingModal({ open, onClose, person, questions, onSubmit, submitting }: {
  open: boolean; onClose: (hasIncompleteAnswers: boolean) => void;
  person: (SurveyPerson & { has_rated?: boolean }) | null;
  questions: SurveyQuestion[];
  onSubmit: (answers: { question_id: number; score?: number | null; emoji_rating?: EmojiRatingValue | null; comment?: string | null }[]) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, DraftAnswer>>({});
  const [localErrors, setLocalErrors] = useState<Record<number, string>>({});
  const [step, setStep] = useState(0);
  // For long surveys, present one question at a time to reduce scrolling.
  const paged = questions.length > 3;

  useEffect(() => {
    if (!open) return;
    const init: Record<number, DraftAnswer> = {};
    questions.forEach(q => { init[q.id] = { score: null, emoji_rating: null, comment: '' }; });
    setAnswers(init);
    setLocalErrors({});
    setStep(0);
  }, [open, questions]);

  const updateAnswer = (qId: number, patch: Partial<DraftAnswer>) => {
    setAnswers(cur => ({ ...cur, [qId]: { ...(cur[qId] || { score: null, emoji_rating: null, comment: '' }), ...patch } }));
    setLocalErrors(cur => { const n = { ...cur }; delete n[qId]; return n; });
  };

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

  const validate = () => {
    const errs: Record<number, string> = {};
    for (const q of questions) {
      const a = answers[q.id] || { score: null, emoji_rating: null, comment: '' };
      const comment = a.comment.trim();
      if (q.has_score && q.score_required && a.score === null) { errs[q.id] = 'انتخاب امتیاز برای این سوال الزامی است.'; continue; }
      if (q.has_emoji && q.emoji_required && !a.emoji_rating) { errs[q.id] = 'انتخاب امتیاز ایموجی برای این سوال الزامی است.'; continue; }
      if (q.has_comment && q.comment_required && !comment) { errs[q.id] = 'نوشتن توضیح برای این سوال الزامی است.'; continue; }
      const hasVal = (q.has_score && a.score !== null) || (q.has_emoji && !!a.emoji_rating) || (q.has_comment && !!comment);
      if (!hasVal) errs[q.id] = 'این سوال نباید خالی بماند.';
    }
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateOne = (q: SurveyQuestion) => {
    const a = answers[q.id] || { score: null, emoji_rating: null, comment: '' };
    const comment = a.comment.trim();
    let err = '';
    if (q.has_score && q.score_required && a.score === null) err = 'انتخاب امتیاز برای این سوال الزامی است.';
    else if (q.has_emoji && q.emoji_required && !a.emoji_rating) err = 'انتخاب امتیاز ایموجی برای این سوال الزامی است.';
    else if (q.has_comment && q.comment_required && !comment) err = 'نوشتن توضیح برای این سوال الزامی است.';
    else {
      const hasVal = (q.has_score && a.score !== null) || (q.has_emoji && !!a.emoji_rating) || (q.has_comment && !!comment);
      if (!hasVal) err = 'این سوال نباید خالی بماند.';
    }
    if (err) setLocalErrors(cur => ({ ...cur, [q.id]: err }));
    return !err;
  };

  const goNext = () => {
    if (!validateOne(questions[step])) return;
    setStep(s => Math.min(s + 1, questions.length - 1));
  };

  const submit = () => {
    if (!validate()) return;
    onSubmit(questions.map(q => ({
      question_id: q.id,
      score: q.has_score ? answers[q.id]?.score ?? null : null,
      emoji_rating: q.has_emoji ? answers[q.id]?.emoji_rating ?? null : null,
      comment: q.has_comment ? answers[q.id]?.comment?.trim() || null : null,
    })));
  };

  const handleCloseAttempt = () => {
    if (submitting) return;
    const incomplete = !person?.has_rated && questions.some(q => {
      const a = answers[q.id] || { score: null, emoji_rating: null, comment: '' };
      const comment = a.comment.trim();
      const hasVal = (q.has_score && a.score !== null) || (q.has_emoji && !!a.emoji_rating) || (q.has_comment && !!comment);
      return !hasVal;
    });
    onClose(incomplete);
  };

  return (
    <Modal open={open} onClose={handleCloseAttempt} size="lg">
      <div className="p-4 sm:p-6 max-h-[85dvh] overflow-y-auto">
        {person && (
          <>
            <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3 sm:gap-4 mb-5 pb-5 border-b border-gray-100">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[color:var(--c-100)] flex-shrink-0 shadow-sm">
                {person.photo_url
                  ? <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center text-[color:var(--c-400)] text-2xl font-bold">{person.full_name[0]}</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 text-base">{person.full_name}</p>
                <p className="text-sm text-gray-400">{[person.role_title, person.department].filter(Boolean).join(' — ')}</p>
                <p className="text-xs text-gray-500 mt-1.5">
                  {paged
                    ? `سوال ${formatNumber(step + 1)} از ${formatNumber(questions.length)}`
                    : `برای این فرد باید به همه ${formatNumber(questions.length)} سوال پاسخ دهید.`}
                </p>
                {paged && (
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[color:var(--c-500)] transition-all duration-300"
                      style={{ width: `${((step + 1) / questions.length) * 100}%` }}/>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 mb-5">
              {questions.map((q, idx) => {
                if (paged && idx !== step) return null;
                const a = answers[q.id] || { score: null, emoji_rating: null, comment: '' };
                return (
                  <div key={q.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="mb-3">
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">{formatNumber(idx + 1)}. {q.text}</p>
                      {q.help_text && <p className="text-xs text-gray-400 mt-1">{q.help_text}</p>}
                      <p className="text-[11px] text-gray-400 mt-1">{getQuestionTypeLabel(q)}</p>
                    </div>

                    {q.has_score && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">امتیاز ۱ تا ۱۰ {q.score_required ? <span className="text-red-500">*</span> : <span className="text-gray-400">(اختیاری)</span>}</p>
                        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                          {[1,2,3,4,5,6,7,8,9,10].map(s => (
                            <button key={s} type="button" onClick={() => updateAnswer(q.id, { score: s })}
                              className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${getColor(s, a.score === s)}`}>
                              {formatNumber(s)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {q.has_emoji && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">امتیاز کیفی {q.emoji_required ? <span className="text-red-500">*</span> : <span className="text-gray-400">(اختیاری)</span>}</p>
                        <EmojiPicker value={a.emoji_rating} onChange={v => updateAnswer(q.id, { emoji_rating: v })}/>
                      </div>
                    )}

                    {q.has_comment && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">
                          توضیحات {q.comment_required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(اختیاری)</span>}
                        </label>
                        <textarea value={a.comment} onChange={e => updateAnswer(q.id, { comment: e.target.value })}
                          rows={3} maxLength={1000} placeholder="نظر یا توضیح خود را بنویسید..."
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--c-400)] focus:border-transparent resize-none placeholder-gray-300 leading-relaxed bg-white"/>
                        {a.comment.length > 0 && <p className="text-xs text-gray-400 text-left mt-1">{formatNumber(a.comment.length)}/{formatNumber(1000)}</p>}
                      </div>
                    )}

                    {localErrors[q.id] && <p className="text-xs text-red-500 mt-2">{localErrors[q.id]}</p>}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 sm:gap-3 pt-3 border-t border-gray-100">
              {paged ? (
                <>
                  {step < questions.length - 1 ? (
                    <button onClick={goNext} className="btn-primary flex-1 min-w-0">بعدی</button>
                  ) : (
                    <button onClick={submit} disabled={submitting}
                      className="btn-primary flex-1 min-w-0 flex items-center justify-center gap-2">
                      {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"/>}
                      <span className="truncate">ثبت همه پاسخ‌ها</span>
                    </button>
                  )}
                  <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0 || submitting}
                    className="btn-secondary flex-1 min-w-0 disabled:opacity-40">قبلی</button>
                </>
              ) : (
                <>
                  <button onClick={submit} disabled={submitting}
                    className="btn-primary flex-1 min-w-0 flex items-center justify-center gap-2">
                    {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0"/>}
                    <span className="truncate">ثبت همه پاسخ‌ها</span>
                  </button>
                  <button onClick={handleCloseAttempt} className="btn-secondary flex-1 min-w-0" disabled={submitting}>انصراف</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function AnonymousSurvey() {
  const { mode } = useTheme();
  const { token } = useParams<{ token: string }>();
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ratingPerson, setRatingPerson] = useState<(SurveyPerson & { has_rated?: boolean }) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closeNotice, setCloseNotice] = useState<{ incomplete: boolean; remaining: number } | null>(null);
  const [ratedPersonIds, setRatedPersonIds] = useState<Set<number>>(new Set());
  const [ipLocked, setIpLocked] = useState(false);
  const [focusPersonId, setFocusPersonId] = useState<number | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const anonToken = token ? getOrCreateAnonToken(token) : '';

  const loadSurvey = useCallback(() => {
    if (!token) return;
    anonymousApi.survey(token)
      .then(r => {
        setSurvey(r.data);
        if (r.data.ip_locked) setIpLocked(true);
      })
      .catch(err => {
        const msg = getErrorMessage(err);
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const loadMyRatings = useCallback(() => {
    if (!token || !survey) return;
    anonymousApi.myRatings(token, survey.id, anonToken)
      .then(r => {
        const ids = new Set<number>(r.data.rated_person_ids);
        setRatedPersonIds(ids);
        if ((r.data as any).ip_locked) setIpLocked(true);
      })
      .catch(() => {});
  }, [token, survey, anonToken]);

  useEffect(() => { loadSurvey(); }, [loadSurvey]);
  useEffect(() => { if (survey) loadMyRatings(); }, [survey?.id]);

  useEffect(() => {
    if (!closeNotice) return;
    const messages: string[] = [];
    if (closeNotice.incomplete) messages.push('شما باید به تمام سوالات پاسخ دهید.');
    if (closeNotice.remaining > 0) {
      messages.push(`شما باید به ${formatNumber(closeNotice.remaining)} نفر باقی‌مانده پاسخ دهید.`);
    }
    if (messages.length > 0) {
      toast.error(messages.join(' '), {
        id: 'anonymous-survey-close-warning',
        duration: 5000,
      });
    }
    setCloseNotice(null);
  }, [closeNotice]);

  const handleCloseRatingModal = (incomplete: boolean) => {
    const remaining = survey?.people.filter(
      person => person.is_active !== false && !ratedPersonIds.has(person.id),
    ).length ?? 0;
    setRatingPerson(null);
    setCloseNotice({ incomplete, remaining });
  };

  const handleSubmitRating = async (answers: { question_id: number; score?: number | null; emoji_rating?: EmojiRatingValue | null; comment?: string | null }[]) => {
    if (!ratingPerson || !token) return;
    setSubmitting(true);
    try {
      await anonymousApi.rate(token, ratingPerson.id, answers, anonToken);
      toast.success('پاسخ‌ها با موفقیت ثبت شد');
      const newRatedIds = new Set([...ratedPersonIds, ratingPerson.id]);
      setRatedPersonIds(newRatedIds);
      // Find the next unanswered active person so we can focus/scroll to them.
      const nextPerson = (survey?.people || []).find(
        p => p.is_active !== false && p.id !== ratingPerson.id && !newRatedIds.has(p.id)
      );
      setFocusPersonId(nextPerson ? nextPerson.id : null);
      setRatingPerson(null);
      if (survey) {
        const totalPeople = survey.people.filter((p: any) => p.is_active !== false).length;
        const remaining = totalPeople - newRatedIds.size;
        if (remaining > 0) {
          toast(`شما باید به ${formatNumber(remaining)} نفر دیگر پاسخ دهید.`);
        } else if (totalPeople > 0) {
          setIpLocked(true);
        }
      }
    } catch (err) {
      const errMsg = getErrorMessage(err);
      if (errMsg.includes('IP') || errMsg.includes('قبلا') || errMsg.includes('قبلاً')) {
        setIpLocked(true);
      }
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // When a next unanswered person is queued, scroll them into view and mark them.
  useEffect(() => {
    if (focusPersonId == null) return;
    const el = rowRefs.current.get(focusPersonId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => setFocusPersonId(null), 2000);
    return () => clearTimeout(t);
  }, [focusPersonId]);

  if (loading) return <AnonymousSurveySkeleton/>;

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4" dir="rtl">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
        <h1 className="text-lg font-bold text-slate-800 mb-2">لینک نامعتبر</h1>
        <p className="text-gray-500 text-sm">{error}</p>
        <CopyrightNotice className="mt-6" />
      </div>
    </div>
  );

  if (!survey) return null;

  const people = (survey.people || []).map(p => ({ ...p, has_rated: ipLocked || ratedPersonIds.has(p.id) }));
  const ratedCount = people.filter(p => p.has_rated).length;
  const totalCount = people.length;
  const questionCount = survey.questions.length;
  const closed = survey.status === 'closed';
  const allDone = ratedCount === totalCount && totalCount > 0;
  const nextUnanswered = !closed && !ipLocked ? people.find(p => !p.has_rated) : undefined;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--c-bg)' }} dir="rtl">
<header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--c-600)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>
            </svg>
          </div>
          <span className="font-bold text-slate-700 text-sm">نظرسنجی ناشناس</span>
          <div className="mr-auto flex items-center gap-2">
            <VersionBadge />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className={`max-w-4xl mx-auto px-4 py-6 ${nextUnanswered && !allDone ? 'pb-28' : ''}`}>
        {closed && (
          <div className="mb-5 flex items-center gap-3 rounded-xl px-5 py-3 border" style={{ backgroundColor: 'var(--c-50)', borderColor: 'var(--c-200)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--c-700)' }}>این نظرسنجی بسته شده است</p>
          </div>
        )}
        {ipLocked && !closed && (
          <div className="mb-5 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4">
            <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">شما قبلاً در این نظرسنجی شرکت کرده‌اید</p>
              <p className="text-xs text-emerald-600 mt-0.5">پاسخ‌های شما ثبت شده است — هر مرورگر فقط یک بار می‌تواند در این نظرسنجی شرکت کند. ممنون از وقت شما!</p>
            </div>
          </div>
        )}
        {allDone && !ipLocked && !closed && (
          <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
            <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p className="text-sm font-medium text-emerald-700">شما در تمام بخش‌های این نظرسنجی شرکت کرده‌اید. ممنون از وقت شما!</p>
          </div>
        )}

        <div className="card p-4 sm:p-6 mb-6">
          <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between gap-3 mb-4">
            <h1 className="text-xl font-bold text-slate-800 leading-snug">{survey.title}</h1>
            <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border"
              style={closed
                ? { backgroundColor: 'var(--c-50)', color: 'var(--c-700)', borderColor: 'var(--c-200)' }
                : { backgroundColor: mode === 'dark' ? 'rgba(16,185,129,0.16)' : '#ecfdf5', color: mode === 'dark' ? '#6ee7b7' : '#065f46', borderColor: mode === 'dark' ? 'rgba(16,185,129,0.35)' : '#a7f3d0' }}>
              {closed ? 'بسته شده' : 'فعال'}
            </span>
          </div>

          {survey.description && <p className="text-sm text-gray-400 leading-relaxed border-t border-gray-100 pt-3 mt-3">{survey.description}</p>}
        </div>

        {people.length === 0 ? (
          <div className="card p-12 text-center"><p className="text-gray-400 text-sm">هنوز فردی به این نظرسنجی اضافه نشده است</p></div>
        ) : questionCount === 0 ? (
          <div className="card p-12 text-center"><p className="text-gray-400 text-sm">این نظرسنجی سوال فعالی ندارد</p></div>
        ) : (
          <>
            <div className="card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">{formatNumber(ratedCount)} از {formatNumber(totalCount)} نفر تکمیل شد</p>
                <p className="text-xs text-gray-400">{formatNumber(Math.round((ratedCount / totalCount) * 100))}٪</p>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${(ratedCount / totalCount) * 100}%` }}/>
              </div>
            </div>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {people.map(p => (
                <AnonymousPersonCard key={p.id} person={p}
                  rowRef={el => { if (el) rowRefs.current.set(p.id, el); else rowRefs.current.delete(p.id); }}
                  highlight={focusPersonId === p.id}
                  onRate={() => !closed && !ipLocked && setRatingPerson(p)}
                  disabled={closed || ipLocked}/>
              ))}
            </div>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">شرکت در این نظرسنجی کاملاً ناشناس است. هیچ اطلاعات شخصی ذخیره نمی‌شود.</p>
          <CopyrightNotice className="mt-2" />
        </div>
      </main>

      {nextUnanswered && !allDone && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <button onClick={() => setRatingPerson(nextUnanswered)}
              className="w-full rounded-xl bg-[color:var(--c-600)] hover:bg-[color:var(--c-700)] active:bg-purple-800 text-white text-sm font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
              style={{ minHeight: 44 }}>
              ادامه با نفر بعدی
              <span className="text-xs opacity-80 truncate max-w-[40%]">({nextUnanswered.full_name})</span>
            </button>
          </div>
        </div>
      )}

      <RatingModal
        open={!!ratingPerson}
        onClose={handleCloseRatingModal}
        person={ratingPerson}
        questions={ratingPerson?.questions ?? survey.questions.filter(q => !ratingPerson?.question_ids || ratingPerson.question_ids.includes(q.id))}
        onSubmit={handleSubmitRating}
        submitting={submitting}
      />
    </div>
  );
}
