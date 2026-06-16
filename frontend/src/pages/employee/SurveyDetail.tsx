import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employeeApi } from '../../api/endpoints';
import { SurveyPerson } from '../../types';
import { PageLoader, Modal } from '../../components/common/index';
import { getErrorMessage } from '../../utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface SurveyDetailData {
  id: number; title: string; question: string; description: string;
  status: string; is_active: boolean; people: (SurveyPerson & { has_rated: boolean })[];
}

function PersonCard({ person, onRate, disabled }: {
  person: SurveyPerson & { has_rated: boolean };
  onRate: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="person-card group">
      {/* Photo */}
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
        {!person.has_rated && !disabled && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-200 flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-[color:var(--c-600)] text-white text-xs font-medium px-3 py-1 rounded-full shadow-lg">
              ثبت امتیاز
            </span>
          </div>
        )}
      </div>

      {/* Info */}
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
              ثبت امتیاز
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RatingModal({ open, onClose, person, question, onSubmit, submitting }: {
  open: boolean; onClose: () => void;
  person: (SurveyPerson & { has_rated: boolean }) | null;
  question: string; onSubmit: (score: number, comment: string) => void; submitting: boolean;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  useEffect(() => { if (open) { setScore(null); setComment(''); } }, [open]);

  const getColor = (s: number, selected: boolean) => {
    if (selected) {
      if (s <= 3) return 'bg-red-500 border-red-500 text-white shadow-lg scale-110';
      if (s <= 6) return 'bg-amber-500 border-amber-500 text-white shadow-lg scale-110';
      return 'bg-emerald-500 border-emerald-500 text-white shadow-lg scale-110';
    }
    if (s <= 3) return 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100';
    if (s <= 6) return 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100';
    return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100';
  };

  const scoreLabel = (s: number) => {
    if (s <= 2) return 'خیلی ضعیف';
    if (s <= 4) return 'ضعیف';
    if (s <= 6) return 'متوسط';
    if (s <= 8) return 'خوب';
    return 'عالی';
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="p-6">
        {person && (
          <>
            {/* Person */}
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
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
                {person.description && (
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{person.description}</p>
                )}
              </div>
            </div>

            {/* Question */}
            <div className="mb-5 rounded-xl px-4 py-3" style={{ backgroundColor: "var(--c-50)" }}>
              <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--c-800)" }}>{question}</p>
            </div>

            {/* Score buttons */}
            <p className="text-xs text-gray-500 mb-3">امتیاز خود را انتخاب کنید (۱ تا ۱۰)</p>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[1,2,3,4,5,6,7,8,9,10].map(s => (
                <button
                  key={s}
                  onClick={() => setScore(s)}
                  className={`py-3 rounded-xl border-2 text-sm font-bold transition-all duration-150 ${getColor(s, score === s)}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 px-1 mb-4">
              <span>ضعیف</span>
              <span>عالی</span>
            </div>

            {/* Score label */}
            <AnimatePresence>
              {score !== null && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-5"
                >
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600">امتیاز انتخابی شما</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: score !== null && score <= 3 ? '#ef4444' : score !== null && score <= 6 ? '#f59e0b' : '#10b981' }}>{score !== null ? scoreLabel(score) : ''}</span>
                      <span className="text-lg font-bold" style={{ color: score !== null && score <= 3 ? '#ef4444' : score !== null && score <= 6 ? '#f59e0b' : '#10b981' }}>{score}</span>
                      <span className="text-xs text-gray-400">از ۱۰</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Comment box */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                توضیحات <span className="text-gray-400 font-normal">(اختیاری)</span>
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="می‌توانید نظر یا توضیح تکمیلی درباره این فرد بنویسید..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--c-400)] focus:border-transparent resize-none placeholder-gray-300 leading-relaxed"
              />
              {comment.length > 0 && (
                <p className="text-xs text-gray-400 text-left mt-1">{comment.length}/۱۰۰۰</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => score !== null && onSubmit(score, comment)}
                disabled={score === null || submitting}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
                ثبت امتیاز
              </button>
              <button onClick={onClose} className="btn-secondary" disabled={submitting}>انصراف</button>
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

  const handleSubmitRating = async (score: number, comment: string) => {
    if (!ratingPerson) return;
    setSubmitting(true);
    try {
      await employeeApi.rate(surveyId, ratingPerson.id, score, comment);
      toast.success('امتیاز با موفقیت ثبت شد ✓');
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

  const ratedCount    = survey.people.filter(p => p.has_rated).length;
  const totalCount    = survey.people.length;
  const closed        = survey.status === 'closed';
  const isEnded       = closed;
  const pct           = totalCount > 0 ? Math.round((ratedCount / totalCount) * 100) : 0;
  const allDone       = ratedCount === totalCount && totalCount > 0;

  return (
    <div>
      {/* Back button + breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
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

      {/* Status banners */}
      {closed && (
        <div className="mb-5 flex items-center gap-3 rounded-xl px-5 py-3 border" style={{ backgroundColor: 'var(--c-50)', borderColor: 'var(--c-200)' }}>
          <svg className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c-500)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--c-700)' }}>این نظرسنجی بسته شده است</p>
        </div>
      )}
      {allDone && !isEnded && (
        <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-sm font-medium text-emerald-700">شما در تمام بخش‌های این نظرسنجی شرکت کرده‌اید</p>
        </div>
      )}

      {/* Survey header card */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-xl font-bold text-slate-800 leading-snug">{survey.title}</h1>
          <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border"
            style={closed
              ? { backgroundColor: 'var(--c-50)', color: 'var(--c-700)', borderColor: 'var(--c-200)' }
              : { backgroundColor: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
            {closed ? 'بسته شده' : 'فعال'}
          </span>
        </div>

        <p className="text-gray-600 leading-relaxed">{survey.question}</p>
        {survey.description && (
          <p className="text-sm text-gray-400 leading-relaxed border-t border-gray-100 pt-3 mt-3">{survey.description}</p>
        )}

        {/* Progress */}
        {totalCount > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>پیشرفت امتیازدهی</span>
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

      {/* People grid */}
      {survey.people.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <p className="text-gray-400 text-sm">هنوز فردی به این نظرسنجی اضافه نشده است</p>
        </div>
      ) : (
        <>
          {/* All-or-nothing notice */}
          {!isEnded && !allDone && (
            <div className="mb-4 flex items-start gap-3 rounded-xl px-4 py-3 border text-sm"
              style={{ backgroundColor: 'var(--c-50)', borderColor: 'var(--c-200)', color: 'var(--c-700)' }}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>شما باید به <strong>تمام {totalCount} نفر</strong> امتیاز دهید. امتیازدهی ناقص ثبت نخواهد شد.
                {ratedCount > 0 && <span className="mr-1">({totalCount - ratedCount} نفر باقی‌مانده)</span>}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">{totalCount} نفر در این نظرسنجی</p>
            {!isEnded && ratedCount > 0 && !allDone && (
              <p className="text-xs text-gray-400">{ratedCount} از {totalCount} ثبت شده</p>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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

      {/* Bottom back button */}
      <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={() => navigate('/surveys')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-[color:var(--c-700)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          بازگشت به لیست نظرسنجی‌ها
        </button>
        {allDone && (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            تکمیل شد
          </span>
        )}
      </div>

      <RatingModal
        open={!!ratingPerson}
        onClose={() => setRatingPerson(null)}
        person={ratingPerson}
        question={survey.question}
        onSubmit={handleSubmitRating}
        submitting={submitting}
      />
    </div>
  );
}
