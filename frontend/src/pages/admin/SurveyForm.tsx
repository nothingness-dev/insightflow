import { useEffect, useMemo, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminSurveyApi } from '../../api/endpoints';
import { Survey, SurveyQuestionInput } from '../../types';
import { Modal, PageHeader, FormSkeleton } from '../../components/common/index';
import { formatNumber, getErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import toast from 'react-hot-toast';

const createEmptyQuestion = (displayOrder: number): SurveyQuestionInput => ({
  text: '',
  help_text: '',
  has_score: true,
  score_required: true,
  has_comment: false,
  comment_required: false,
  has_emoji: false,
  emoji_required: false,
  display_order: displayOrder,
  is_active: true,
});

export default function SurveyForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    results_visibility: 'admin_only';
    questions: SurveyQuestionInput[];
  }>({
    title: '',
    description: '',
    results_visibility: 'admin_only',
    questions: [createEmptyQuestion(0)],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [surveyStatus, setSurveyStatus] = useState<string>('draft');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null);
  const autosaveKey = useMemo(() => `insightflow:survey-draft:${id || 'new'}`, [id]);

  useEffect(() => {
    if (!isEdit) return;
    const controller = new AbortController();
    adminSurveyApi.get(Number(id), controller.signal)
      .then(r => {
        const s: Survey = r.data;
        const questions = s.questions?.length
          ? s.questions
              .filter(q => q.is_active !== false)
              .map((q, index) => ({
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
          : [
              {
                ...createEmptyQuestion(0),
                text: s.question || '',
              },
            ];

        setSurveyStatus(s.status || 'draft');
        setForm({
          title: s.title,
          description: s.description,
          results_visibility: 'admin_only',
          questions,
        });
        setAutosaveReady(true);
      })
      .catch(error => {
        if (isCanceledRequest(error, controller.signal)) return;
        toast.error('خطا در بارگذاری نظرسنجی');
        navigate('/admin/surveys');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, isEdit, navigate]);

  const isDraft = surveyStatus === 'draft';

  useEffect(() => {
    if (isEdit || autosaveReady) return;
    const raw = localStorage.getItem(autosaveKey);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (saved?.form) {
          setForm(saved.form);
          setAutosavedAt(saved.savedAt || null);
          toast.success('پیش‌نویس ذخیره‌شده بازیابی شد');
        }
      } catch {
        localStorage.removeItem(autosaveKey);
      }
    }
    setAutosaveReady(true);
  }, [autosaveKey, autosaveReady, isEdit]);

  useEffect(() => {
    if (!autosaveReady || !isDraft) return;
    const hasContent = form.title.trim() || form.description.trim() || form.questions.some(q => q.text.trim() || q.help_text.trim());
    if (!hasContent) return;
    const handle = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem(autosaveKey, JSON.stringify({ form, savedAt }));
      setAutosavedAt(savedAt);
    }, 700);
    return () => window.clearTimeout(handle);
  }, [autosaveKey, autosaveReady, form, isDraft]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'عنوان الزامی است';
    if (form.questions.length === 0) e.questions = 'حداقل یک سوال الزامی است';

    form.questions.forEach((question, index) => {
      if (!question.text.trim()) e[`question_${index}`] = 'متن سوال الزامی است';
      if (!question.has_score && !question.has_comment && !question.has_emoji) {
        e[`question_type_${index}`] = 'هر سوال باید حداقل یک نوع پاسخ (امتیاز عددی، امتیاز ایموجی یا توضیح متنی) داشته باشد';
      }
      if (!question.has_score && question.score_required) {
        e[`question_type_${index}`] = 'وقتی امتیاز غیرفعال است، نمی‌تواند الزامی باشد';
      }
      if (!question.has_comment && question.comment_required) {
        e[`question_type_${index}`] = 'وقتی توضیح غیرفعال است، نمی‌تواند الزامی باشد';
      }
      if (!question.has_emoji && question.emoji_required) {
        e[`question_type_${index}`] = 'وقتی امتیاز ایموجی غیرفعال است، نمی‌تواند الزامی باشد';
      }
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const payload = () => {
    const base = {
      title: form.title.trim(),
      description: form.description.trim(),
      results_visibility: form.results_visibility,
    };
    if (!isDraft) return base;
    return {
      ...base,
      questions: form.questions.map((question, index) => ({
        ...question,
        text: question.text.trim(),
        help_text: question.help_text.trim(),
        score_required: question.has_score ? question.score_required : false,
        comment_required: question.has_comment ? question.comment_required : false,
        emoji_required: question.has_emoji ? question.emoji_required : false,
        display_order: index,
        is_active: true,
      })),
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await adminSurveyApi.update(Number(id), payload());
        localStorage.removeItem(autosaveKey);
        toast.success('تغییرات ذخیره شد');
        navigate(`/admin/surveys/${id}`);
      } else {
        const r = await adminSurveyApi.create(payload());
        localStorage.removeItem(autosaveKey);
        toast.success('نظرسنجی ایجاد شد');
        navigate(`/admin/surveys/${r.data.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (field: 'title' | 'description') =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }));
      if (errors[field]) setErrors(er => ({ ...er, [field]: '' }));
    };

  const updateQuestion = (index: number, patch: Partial<SurveyQuestionInput>) => {
    setForm(f => ({
      ...f,
      questions: f.questions.map((question, i) => {
        if (i !== index) return question;
        const next = { ...question, ...patch };
        if (!next.has_score) next.score_required = false;
        if (!next.has_comment) next.comment_required = false;
        if (!next.has_emoji) next.emoji_required = false;
        return next;
      }),
    }));
    setErrors(er => {
      const next = { ...er };
      delete next[`question_${index}`];
      delete next[`question_type_${index}`];
      delete next.questions;
      return next;
    });
  };

  const addQuestion = () => {
    setForm(f => ({ ...f, questions: [...f.questions, createEmptyQuestion(f.questions.length)] }));
  };

  const removeQuestion = (index: number) => {
    setForm(f => ({
      ...f,
      questions: f.questions.length === 1
        ? f.questions
        : f.questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, display_order: i })),
    }));
  };

  const clearAutosave = () => {
    localStorage.removeItem(autosaveKey);
    setAutosavedAt(null);
    toast.success('پیش‌نویس ذخیره‌شده پاک شد');
  };

  const openPreview = () => {
    if (!validate()) return;
    setPreviewOpen(true);
  };

  if (loading) return <FormSkeleton />;

  return (
    <div className="responsive-page max-w-3xl">
      <PageHeader
        title={isEdit ? 'ویرایش نظرسنجی' : 'نظرسنجی جدید'}
        subtitle={isEdit ? (isDraft ? 'اطلاعات و سوال‌های نظرسنجی را ویرایش کنید' : 'فقط عنوان و توضیحات قابل ویرایش است. سوال‌ها و افراد در حالت منتشرشده قفل هستند.') : 'سوال‌های چندگانه برای همه افراد نظرسنجی تعریف کنید'}
      />

      <form onSubmit={handleSubmit} className="card p-4 sm:p-6 space-y-6">
        {isDraft && (
          <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-emerald-800">ذخیره خودکار پیش‌نویس فعال است</p>
              <p className="text-xs text-emerald-700 mt-1">
                {autosavedAt ? `آخرین ذخیره: ${new Date(autosavedAt).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : 'تغییرات فرم روی همین دستگاه نگه داشته می‌شود.'}
              </p>
            </div>
            {autosavedAt && (
              <button type="button" onClick={clearAutosave} className="btn-secondary w-full min-[420px]:w-auto text-xs">پاک کردن ذخیره محلی</button>
            )}
          </div>
        )}

        {!isDraft && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">ساختار این نظرسنجی قفل است</p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">بعد از انتشار یا بستن، سوال‌ها و افراد برای حفظ اعتبار پاسخ‌ها تغییر نمی‌کنند. در این صفحه فقط عنوان و توضیحات ذخیره می‌شود.</p>
          </div>
        )}

        <div>
          <label className="label">عنوان نظرسنجی <span className="text-red-500">*</span></label>
          <input
            type="text" value={form.title} onChange={set('title')}
            className={`input-field ${errors.title ? 'border-red-400' : ''}`}
            placeholder="مثال: نظرسنجی ارزیابی عملکرد کارکنان"
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        <div>
          <label className="label">توضیحات / راهنمای شرکت‌کنندگان</label>
          <textarea
            value={form.description} onChange={set('description')} rows={3}
            className="input-field resize-none"
            placeholder="توضیحات یا راهنمایی برای شرکت‌کنندگان..."
          />
        </div>

        {isDraft && (
        <div className="border-t border-gray-100 pt-5">
          <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 mb-4">
            <div>
              <h2 className="font-bold text-slate-800">سوال‌های نظرسنجی</h2>
              <p className="text-xs text-gray-400 mt-1">کاربر برای هر فرد باید به همه سوال‌های فعال پاسخ بدهد.</p>
            </div>
            <button type="button" onClick={addQuestion} className="btn-secondary w-full min-[420px]:w-auto text-sm">افزودن سوال</button>
          </div>
          {errors.questions && <p className="text-xs text-red-500 mb-3">{errors.questions}</p>}

          <div className="space-y-4">
            {form.questions.map((question, index) => (
              <div key={question.id || index} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-bold text-slate-700">سوال {formatNumber(index + 1)}</p>
                  <button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    disabled={form.questions.length === 1}
                    className="text-xs font-medium text-red-500 disabled:text-gray-300"
                  >
                    حذف
                  </button>
                </div>

                <textarea
                  value={question.text}
                  onChange={e => updateQuestion(index, { text: e.target.value })}
                  rows={2}
                  className={`input-field resize-none bg-white ${errors[`question_${index}`] ? 'border-red-400' : ''}`}
                  placeholder="مثال: کیفیت همکاری این فرد را چگونه ارزیابی می‌کنید؟"
                />
                {errors[`question_${index}`] && <p className="text-xs text-red-500 mt-1">{errors[`question_${index}`]}</p>}

                <input
                  value={question.help_text}
                  onChange={e => updateQuestion(index, { help_text: e.target.value })}
                  className="input-field bg-white mt-3"
                  placeholder="راهنمای اختیاری برای این سوال"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="rounded-xl bg-white border border-gray-100 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={question.has_score}
                        onChange={e => updateQuestion(index, { has_score: e.target.checked })}
                      />
                      امتیاز عددی ۱ تا ۱۰
                    </label>
                    {question.has_score && (
                      <label className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                        <input
                          type="checkbox"
                          checked={question.score_required}
                          onChange={e => updateQuestion(index, { score_required: e.target.checked })}
                        />
                        امتیاز عددی الزامی باشد
                      </label>
                    )}
                  </div>

                  <div className="rounded-xl bg-white border border-gray-100 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={question.has_emoji}
                        onChange={e => updateQuestion(index, { has_emoji: e.target.checked })}
                      />
                      امتیاز ایموجی (بد تا عالی)
                    </label>
                    {question.has_emoji && (
                      <label className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                        <input
                          type="checkbox"
                          checked={question.emoji_required}
                          onChange={e => updateQuestion(index, { emoji_required: e.target.checked })}
                        />
                        امتیاز ایموجی الزامی باشد
                      </label>
                    )}
                  </div>

                  <div className="rounded-xl bg-white border border-gray-100 p-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={question.has_comment}
                        onChange={e => updateQuestion(index, { has_comment: e.target.checked })}
                      />
                      کادر توضیح متنی
                    </label>
                    {question.has_comment && (
                      <label className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                        <input
                          type="checkbox"
                          checked={question.comment_required}
                          onChange={e => updateQuestion(index, { comment_required: e.target.checked })}
                        />
                        توضیح متنی الزامی باشد
                      </label>
                    )}
                  </div>
                </div>


                {errors[`question_type_${index}`] && <p className="text-xs text-red-500 mt-2">{errors[`question_type_${index}`]}</p>}
              </div>
            ))}
          </div>
        </div>

        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto flex items-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isEdit ? 'ذخیره تغییرات' : 'ایجاد نظرسنجی'}
          </button>
          {isDraft && (
            <button type="button" onClick={openPreview} className="btn-secondary w-full sm:w-auto">پیش‌نمایش</button>
          )}
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary w-full sm:w-auto">انصراف</button>
        </div>      </form>
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="پیش‌نمایش نظرسنجی" size="lg">
        <div className="p-4 sm:p-6 space-y-5" dir="rtl">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-2">نمای شرکت‌کننده</p>
            <h2 className="text-lg font-bold text-slate-800 leading-snug">{form.title || 'عنوان نظرسنجی'}</h2>
            {form.description && <p className="text-sm text-gray-500 leading-relaxed mt-2">{form.description}</p>}
          </div>
          <div className="space-y-3">
            {form.questions.map((question, index) => (
              <div key={index} className="rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-bold text-slate-800">{formatNumber(index + 1)}. {question.text}</p>
                {question.help_text && <p className="text-xs text-gray-400 mt-1">{question.help_text}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {question.has_score && <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">امتیاز عددی {question.score_required ? 'الزامی' : 'اختیاری'}</span>}
                  {question.has_emoji && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">ایموجی {question.emoji_required ? 'الزامی' : 'اختیاری'}</span>}
                  {question.has_comment && <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">توضیح {question.comment_required ? 'الزامی' : 'اختیاری'}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => setPreviewOpen(false)} className="btn-primary">بستن پیش‌نمایش</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
