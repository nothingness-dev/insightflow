import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { employeeApi } from '../../api/endpoints';
import { SurveyPerson } from '../../types';
import { PageLoader, Modal } from '../../components/common/index';
import { getErrorMessage, isSurveyExpired } from '../../utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface SurveyDetailData {
  id: number; title: string; question: string; description: string;
  status: string; starts_at: string | null; ends_at: string | null;
  is_active: boolean; people: (SurveyPerson & { has_rated: boolean })[];
}

function PersonCard({ person, onRate, disabled }: { person: SurveyPerson & { has_rated: boolean }; onRate: () => void; disabled?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="person-card"
    >
      {/* Photo */}
      <div className="relative">
        <div className="w-full aspect-square bg-gray-100 overflow-hidden">
          {person.photo_url ? (
            <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl font-bold">
              {person.full_name[0]}
            </div>
          )}
        </div>
        {person.has_rated && (
          <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
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

        <div className="mt-4">
          {person.has_rated ? (
            <div className="w-full py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium text-center border border-emerald-200">
              ثبت شد
            </div>
          ) : disabled ? (
            <div className="w-full py-2 rounded-lg bg-orange-50 text-orange-600 text-xs font-medium text-center border border-orange-200">
              نظرسنجی به پایان رسیده
            </div>
          ) : (
            <button
              onClick={onRate}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-medium transition-all duration-150 shadow-sm hover:shadow"
            >
              ثبت امتیاز
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function RatingModal({
  open, onClose, person, question, onSubmit, submitting
}: {
  open: boolean; onClose: () => void;
  person: (SurveyPerson & { has_rated: boolean }) | null;
  question: string; onSubmit: (score: number) => void; submitting: boolean;
}) {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => { if (open) setScore(null); }, [open]);

  const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const getScoreColor = (s: number) => {
    if (s <= 3) return 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100';
    if (s <= 6) return 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100';
    return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100';
  };

  const getScoreSelectedColor = (s: number) => {
    if (s <= 3) return 'bg-red-500 border-red-500 text-white shadow-md';
    if (s <= 6) return 'bg-amber-500 border-amber-500 text-white shadow-md';
    return 'bg-emerald-500 border-emerald-500 text-white shadow-md';
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="p-6">
        {person && (
          <>
            {/* Person info */}
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                {person.photo_url ? (
                  <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                    {person.full_name[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{person.full_name}</p>
                <p className="text-sm text-gray-400">{[person.role_title, person.department].filter(Boolean).join(' — ')}</p>
                {person.description && (
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{person.description}</p>
                )}
              </div>
            </div>

            {/* Question */}
            <div className="mb-5">
              <p className="text-sm font-medium text-slate-700 leading-relaxed">{question}</p>
            </div>

            {/* Score selector */}
            <div className="mb-2">
              <p className="text-xs text-gray-500 mb-3">امتیاز خود را انتخاب کنید (۱ تا ۱۰)</p>
              <div className="grid grid-cols-5 gap-2">
                {scores.map(s => (
                  <button
                    key={s}
                    onClick={() => setScore(s)}
                    className={`py-3 rounded-lg border text-sm font-semibold transition-all duration-150 ${
                      score === s ? getScoreSelectedColor(s) : getScoreColor(s)
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
                <span>ضعیف</span>
                <span>عالی</span>
              </div>
            </div>

            {/* Selected score display */}
            <AnimatePresence>
              {score !== null && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4"
                >
                  <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-blue-700">
                    امتیاز انتخابی شما: <strong>{score}</strong> از ۱۰
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => score !== null && onSubmit(score)}
                disabled={score === null || submitting}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
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

  const handleSubmitRating = async (score: number) => {
    if (!ratingPerson) return;
    setSubmitting(true);
    try {
      await employeeApi.rate(surveyId, ratingPerson.id, score);
      toast.success('امتیاز شما با موفقیت ثبت شد');
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

  if (loading) return <PageLoader />;
  if (!survey) return (
    <div className="text-center py-16">
      <p className="text-gray-500">نظرسنجی یافت نشد</p>
      <Link to="/surveys" className="text-blue-600 text-sm mt-2 inline-block">بازگشت</Link>
    </div>
  );

  const ratedCount = survey.people.filter(p => p.has_rated).length;
  const totalCount = survey.people.length;
  const expired = isSurveyExpired({ status: survey.status, ends_at: survey.ends_at });
  const surveyStarted = (survey as any).survey_started !== false;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/surveys" className="hover:text-gray-600">نظرسنجی‌ها</Link>
        <span>/</span>
        <span className="text-gray-700">{survey.title}</span>
      </div>

      {/* Not started yet banner */}
      {!surveyStarted && (
        <div className="mb-5 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-blue-700">این نظرسنجی هنوز شروع نشده است — افراد پس از شروع نمایش داده می‌شوند</p>
        </div>
      )}

      {/* Expired banner */}
      {expired && (
        <div className="mb-5 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-5 py-3">
          <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-orange-700">مهلت نظرسنجی به پایان رسیده</p>
        </div>
      )}

      {/* Survey header */}
      <div className="card p-6 mb-6">
        <h1 className="text-xl font-bold text-slate-800 mb-2">{survey.title}</h1>
        <p className="text-gray-600 leading-relaxed mb-3">{survey.question}</p>
        {survey.description && (
          <p className="text-sm text-gray-400 leading-relaxed border-t border-gray-100 pt-3">{survey.description}</p>
        )}

        {/* Progress */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${totalCount > 0 ? (ratedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm text-gray-500 flex-shrink-0">
            {ratedCount} از {totalCount} ثبت شده
          </span>
        </div>
        {ratedCount === totalCount && totalCount > 0 && (
          <div className="mt-3 flex items-center gap-2 text-emerald-600 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            شما در تمام بخش‌های این نظرسنجی شرکت کرده‌اید
          </div>
        )}
      </div>

      {/* People grid */}
      {survey.people.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">هنوز فردی به این نظرسنجی اضافه نشده است</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {survey.people.map(person => (
            <PersonCard
              key={person.id}
              person={person}
              onRate={() => !expired && setRatingPerson(person)}
              disabled={expired}
            />
          ))}
        </div>
      )}

      {/* Rating Modal */}
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
