import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminSurveyApi, adminPersonApi } from '../../api/endpoints';
import { Survey, SurveyPerson, SurveyQuestionInput } from '../../types';
import { StatusBadge, SurveyDetailSkeleton, ConfirmModal, Modal } from '../../components/common/index';
import { formatDateTime, formatNumber, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import toast from 'react-hot-toast';
import PersonModal from '../../components/admin/PersonModal';
import HashLinksPanel from '../../components/admin/HashLinksPanel';
import QuestionsEditor, {
  createEmptyQuestion,
  normalizeQuestionRequirements,
  validateQuestions,
} from '../../components/admin/QuestionsEditor';

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [people, setPeople] = useState<SurveyPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [personModal, setPersonModal] = useState<{ open: boolean; person?: SurveyPerson }>({ open: false });
  const [deletePersonId, setDeletePersonId] = useState<number | null>(null);
  const [deletingPerson, setDeletingPerson] = useState(false);
  const [publishModal, setPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [questionPerson, setQuestionPerson] = useState<SurveyPerson | null>(null);
  const [questionsDraft, setQuestionsDraft] = useState<SurveyQuestionInput[]>([]);
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({});
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [revertingQuestions, setRevertingQuestions] = useState(false);

  const surveyId = Number(id);

  const loadData = (signal?: AbortSignal) => {
    if (!Number.isFinite(surveyId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      adminSurveyApi.get(surveyId, signal),
      adminPersonApi.list(surveyId, signal),
    ]).then(([sr, pr]) => {
      setSurvey(sr.data);
      setPeople(Array.isArray(pr.data) ? pr.data : (pr.data as any).results || []);
    }).catch(error => {
      if (isCanceledRequest(error, signal)) return;
      toast.error('خطا در بارگذاری اطلاعات');
      navigate('/admin/surveys');
    }).finally(() => {
      if (!signal?.aborted) setLoading(false);
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [id]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const r = await adminSurveyApi.publish(surveyId);
      setSurvey(r.data);
      toast.success('نظرسنجی منتشر شد');
      setPublishModal(false);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setPublishing(false); }
  };

  const handleClose = async () => {
    setClosing(true);
    try {
      const r = await adminSurveyApi.close(surveyId);
      setSurvey(r.data);
      toast.success('نظرسنجی بسته شد');
      setCloseModal(false);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setClosing(false); }
  };

  const handleDeleteSurvey = async () => {
    setDeleting(true);
    try {
      await adminSurveyApi.delete(surveyId);
      toast.success('نظرسنجی حذف شد');
      navigate('/admin/surveys');
    } catch (err) { toast.error(getErrorMessage(err)); setDeleting(false); }
  };

  const handleDeletePerson = async () => {
    if (!deletePersonId) return;
    setDeletingPerson(true);
    try {
      await adminPersonApi.delete(deletePersonId);
      toast.success('فرد حذف شد');
      setPeople(p => p.filter(x => x.id !== deletePersonId));
      setDeletePersonId(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeletingPerson(false); }
  };

  const handlePersonSaved = () => {
    setPersonModal({ open: false });
    adminPersonApi.list(surveyId)
      .then(r => setPeople(Array.isArray(r.data) ? r.data : (r.data as any).results || []))
      .catch(error => {
        if (isCanceledRequest(error)) return;
        toast.error('خطا در بارگذاری فهرست افراد');
      });
  };

  const openQuestionEditor = (person: SurveyPerson) => {
    setQuestionPerson(person);
    setQuestionErrors({});
    // Use the person's own live `questions` (always fresh from the last
    // list/save response) rather than the survey-level question array,
    // which only carries shared questions and can go stale after a save.
    const existing = person.uses_default_questions === false
      ? (person.questions ?? [])
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((q, index) => normalizeQuestionRequirements({
            id: q.id,
            text: q.text,
            help_text: q.help_text || '',
            has_score: q.has_score,
            score_required: q.has_score ? q.score_required : false,
            has_comment: q.has_comment,
            comment_required: q.has_comment ? q.comment_required : false,
            has_emoji: q.has_emoji,
            emoji_required: q.has_emoji ? q.emoji_required : false,
            display_order: q.display_order ?? index,
            is_active: true,
          }))
      : [];
    setQuestionsDraft(existing.length ? existing : [createEmptyQuestion(0)]);
  };

  const savePersonQuestions = async () => {
    if (!questionPerson) return;
    const errors = validateQuestions(questionsDraft);
    if (Object.keys(errors).length > 0) {
      setQuestionErrors(errors);
      return;
    }
    setSavingQuestions(true);
    try {
      const response = await adminPersonApi.setQuestions(
        questionPerson.id,
        questionsDraft.map((question, index) =>
          normalizeQuestionRequirements({
            ...question,
            text: question.text.trim(),
            help_text: question.help_text.trim(),
            display_order: index,
            is_active: true,
          }),
        ),
      );
      setPeople(items => items.map(item => item.id === questionPerson.id ? response.data : item));
      toast.success('سوال‌های اختصاصی ذخیره شد');
      setQuestionPerson(null);
    } catch (error) { toast.error(getErrorMessage(error)); }
    finally { setSavingQuestions(false); }
  };

  const revertPersonToDefault = async () => {
    if (!questionPerson) return;
    setRevertingQuestions(true);
    try {
      const response = await adminPersonApi.useDefaultQuestions(questionPerson.id);
      setPeople(items => items.map(item => item.id === questionPerson.id ? response.data : item));
      toast.success('فرد به سوال‌های پیش‌فرض بازگشت');
      setQuestionPerson(null);
    } catch (error) { toast.error(getErrorMessage(error)); }
    finally { setRevertingQuestions(false); }
  };

  if (loading || !survey) return <SurveyDetailSkeleton />;

  return (
    <div className="responsive-page max-w-4xl">
<div className="flex flex-wrap items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/admin/surveys" className="compact-link hover:text-gray-700">نظرسنجی‌ها</Link>
        <span>/</span>
        <span className="text-gray-700">{survey.title}</span>
      </div>
      {survey.status !== 'draft' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
          <p className="text-sm font-semibold text-amber-800">سوال‌ها و افراد این نظرسنجی قفل هستند</p>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">بعد از انتشار، ساختار نظرسنجی تغییر نمی‌کند تا پاسخ‌های ثبت‌شده معتبر بمانند. برای تغییر ساختار، از گزینه کپی استفاده کنید و نسخه پیش‌نویس جدید بسازید.</p>
        </div>
      )}
<div className="card p-4 sm:p-6 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <StatusBadge status={survey.status} />
              <span className="text-xs text-gray-400">{formatDateTime(survey.created_at)}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-1">{survey.title}</h1>
            <p className="text-gray-600 text-sm leading-relaxed">
              {formatNumber(survey.questions_count || survey.questions?.length || 0)} سوال برای هر فرد در این نظرسنجی تعریف شده است.
            </p>
            {survey.description && (
              <p className="text-gray-400 text-xs mt-2 leading-relaxed">{survey.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">افراد</p>
            <p className="text-lg font-semibold text-slate-700">{formatNumber(survey.people_count)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">سوال‌ها</p>
            <p className="text-lg font-semibold text-slate-700">{formatNumber(survey.questions_count || survey.questions?.length || 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">شرکت‌کنندگان (کاربر)</p>
            <p className="text-lg font-semibold text-slate-700">{formatNumber(survey.total_responses)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">شرکت‌کنندگان ناشناس</p>
            <p className="text-lg font-semibold text-emerald-700">{formatNumber(survey.anonymous_participants_count ?? 0)}</p>
          </div>
        </div>
<div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
          {survey.status === 'draft' && (
            <>
              <Link to={`/admin/surveys/${id}/edit`} className="btn-secondary text-sm">ویرایش</Link>
              <button onClick={() => setPublishModal(true)} className="btn-success text-sm">انتشار نظرسنجی</button>
            </>
          )}
          {survey.status === 'published' && (
            <button onClick={() => setCloseModal(true)} className="btn-danger text-sm">بستن نظرسنجی</button>
          )}
          {(survey.status === 'closed' || survey.status === 'published') && (
            <Link to={`/admin/surveys/${id}/results`} className="btn-primary text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              مشاهده نتایج
            </Link>
          )}
          <button onClick={() => setDeleteModal(true)} className="btn-danger text-sm flex items-center gap-1.5 ms-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            حذف نظرسنجی
          </button>
        </div>
      </div>
<div className="card p-4 sm:p-6 mb-5">
        <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 mb-4">
          <h2 className="font-bold text-slate-800">سوال‌های نظرسنجی</h2>
          {survey.status === 'draft' && (
            <Link to={`/admin/surveys/${id}/edit`} className="text-sm text-[color:var(--c-600)] hover:underline">
              ویرایش سوال‌ها
            </Link>
          )}
        </div>
        {survey.questions && survey.questions.length > 0 ? (
          <div className="space-y-3">
            {survey.questions.filter(q => q.is_active !== false).map((question, index) => (
              <div key={question.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                  {formatNumber(index + 1)}. {question.text}
                </p>
                {question.help_text && <p className="text-xs text-gray-400 mt-1">{question.help_text}</p>}
                <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                  {question.has_score && (
                    <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                      امتیاز ۱ تا ۱۰ {question.score_required ? 'الزامی' : 'اختیاری'}
                    </span>
                  )}
                  {question.has_emoji && (
                    <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      امتیاز ایموجی {question.emoji_required ? 'الزامی' : 'اختیاری'}
                    </span>
                  )}
                  {question.has_comment && (
                    <span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                      توضیح متنی {question.comment_required ? 'الزامی' : 'اختیاری'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">هنوز سوالی برای این نظرسنجی تعریف نشده است.</p>
        )}
      </div>
      <div className="card mb-5">
        <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <h2 className="section-title">افراد نظرسنجی</h2>
          {survey.status === 'draft' && (
            <button
              onClick={() => setPersonModal({ open: true })}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              افزودن فرد
            </button>
          )}
        </div>

        {people.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            <p className="mb-3">هنوز فردی اضافه نشده است</p>
            {survey.status === 'draft' && (
              <button onClick={() => setPersonModal({ open: true })} className="btn-primary text-sm">افزودن اولین فرد</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {people.map(person => (
              <div key={person.id} className="px-4 sm:px-6 py-4 flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-3 sm:gap-4 hover:bg-gray-50 transition-colors">
<div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  {person.photo_url ? (
                    <img src={person.photo_url} alt={person.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg font-bold">
                      {person.full_name[0]}
                    </div>
                  )}
                </div>
<div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 text-sm flex items-center gap-2 flex-wrap">
                    {person.full_name}
                    {person.uses_default_questions === false && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">سوال‌های اختصاصی</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{[person.role_title, person.department].filter(Boolean).join(' — ')}</p>
                  {!person.is_active && (
                    <span className="text-xs text-red-500 font-medium">غیرفعال</span>
                  )}
                </div>
{survey.status === 'draft' && (
                  <div className="flex flex-wrap items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openQuestionEditor(person)}
                      className="px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
                    >{person.uses_default_questions === false ? 'ویرایش سوال‌های اختصاصی' : 'افزودن سوال‌های اختصاصی'}</button>
                    <button
                      onClick={() => setPersonModal({ open: true, person })}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={() => setDeletePersonId(person.id)}
                      className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      حذف
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
<HashLinksPanel surveyId={surveyId} surveyStatus={survey.status} />
<PersonModal
        open={personModal.open}
        onClose={() => setPersonModal({ open: false })}
        onSaved={handlePersonSaved}
        surveyId={surveyId}
        person={personModal.person}
      />
      <Modal open={!!questionPerson} onClose={() => !savingQuestions && !revertingQuestions && setQuestionPerson(null)} title="سوال‌های اختصاصی فرد" size="lg">
        <div className="flex flex-col max-h-[80vh]" dir="rtl">
          <div className="p-4 sm:p-5 pb-3 space-y-2 flex-shrink-0">
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 px-3 py-2">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 break-words">{questionPerson?.full_name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                این فرد یک بخش جداگانه در نتایج دارد و با بقیه مقایسه نمی‌شود.
              </p>
            </div>
            {questionPerson?.uses_default_questions !== false && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 leading-relaxed">
                  با ذخیره، سوال‌های پیش‌فرض این فرد حذف و جایگزین سوال‌های زیر می‌شود.
                </p>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5">
            <QuestionsEditor
              questions={questionsDraft}
              onChange={setQuestionsDraft}
              errors={questionErrors}
              onClearError={(key) => setQuestionErrors(er => {
                if (!(key in er)) return er;
                const next = { ...er };
                delete next[key];
                return next;
              })}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end p-4 sm:p-5 pt-3 border-t border-gray-100 flex-shrink-0">
            {questionPerson?.uses_default_questions === false && (
              <button className="btn-secondary w-full sm:w-auto text-red-600" disabled={savingQuestions || revertingQuestions} onClick={revertPersonToDefault}>
                {revertingQuestions ? 'در حال بازگشت…' : 'بازگشت به سوال‌های پیش‌فرض'}
              </button>
            )}
            <button className="btn-secondary w-full sm:w-auto" disabled={savingQuestions || revertingQuestions} onClick={() => setQuestionPerson(null)}>انصراف</button>
            <button className="btn-primary w-full sm:w-auto" disabled={savingQuestions || revertingQuestions} onClick={savePersonQuestions}>{savingQuestions ? 'در حال ذخیره…' : 'ذخیره'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deletePersonId}
        onClose={() => setDeletePersonId(null)}
        onConfirm={handleDeletePerson}
        title="حذف فرد"
        message="آیا از حذف این فرد از نظرسنجی اطمینان دارید؟"
        confirmLabel="حذف"
        loading={deletingPerson}
      />
      <ConfirmModal
        open={publishModal}
        onClose={() => setPublishModal(false)}
        onConfirm={handlePublish}
        title="انتشار نظرسنجی"
        message="پس از انتشار، کارکنان می‌توانند امتیازدهی کنند. آیا مطمئن هستید؟"
        confirmLabel="انتشار"
        confirmVariant="primary"
        loading={publishing}
      />
      <ConfirmModal
        open={closeModal}
        onClose={() => setCloseModal(false)}
        onConfirm={handleClose}
        title="بستن نظرسنجی"
        message="پس از بستن، امکان ثبت امتیاز جدید وجود نخواهد داشت."
        confirmLabel="بستن نظرسنجی"
        loading={closing}
      />
      <ConfirmModal
        open={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDeleteSurvey}
        title="حذف نظرسنجی"
        message="آیا از حذف کامل این نظرسنجی اطمینان دارید؟ تمام افراد، سوال‌ها و امتیازها برای همیشه حذف می‌شوند و این عمل قابل بازگشت نیست."
        confirmLabel="حذف نظرسنجی"
        loading={deleting}
      />
    </div>
  );
}
