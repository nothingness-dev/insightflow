import { useEffect, useMemo, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminSurveyApi } from "../../api/endpoints";
import { Survey, SurveyQuestionInput } from "../../types";
import { Modal, PageHeader, FormSkeleton } from "../../components/common/index";
import { formatNumber, getErrorMessage } from "../../utils/helpers";
import { isCanceledRequest } from "../../utils/http";
import toast from "react-hot-toast";
import QuestionsEditor, {
  createEmptyQuestion,
  validateQuestions,
} from "../../components/admin/QuestionsEditor";

export default function SurveyForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    results_visibility: "admin_only";
    questions: SurveyQuestionInput[];
  }>({
    title: "",
    description: "",
    results_visibility: "admin_only",
    questions: [createEmptyQuestion(0)],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [surveyStatus, setSurveyStatus] = useState<string>("draft");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null);
  const autosaveKey = useMemo(
    () => `InsightFlow:survey-draft:${id || "new"}`,
    [id],
  );

  useEffect(() => {
    if (!isEdit) return;
    const controller = new AbortController();
    adminSurveyApi
      .get(Number(id), controller.signal)
      .then((r) => {
        const s: Survey = r.data;
        const questions = s.questions?.length
          ? s.questions
              .filter((q) => q.is_active !== false)
              .map((q, index) => ({
                id: q.id,
                text: q.text,
                help_text: q.help_text || "",
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
                text: s.question || "",
              },
            ];

        setSurveyStatus(s.status || "draft");
        setForm({
          title: s.title,
          description: s.description,
          results_visibility: "admin_only",
          questions,
        });
        setAutosaveReady(true);
      })
      .catch((error) => {
        if (isCanceledRequest(error, controller.signal)) return;
        toast.error("خطا در بارگذاری نظرسنجی");
        navigate("/admin/surveys");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, isEdit, navigate]);

  const isDraft = surveyStatus === "draft";

  useEffect(() => {
    if (isEdit || autosaveReady) return;
    const raw = localStorage.getItem(autosaveKey);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (saved?.form) {
          setForm(saved.form);
          setAutosavedAt(saved.savedAt || null);
          toast.success("پیش‌نویس ذخیره‌شده بازیابی شد");
        }
      } catch {
        localStorage.removeItem(autosaveKey);
      }
    }
    setAutosaveReady(true);
  }, [autosaveKey, autosaveReady, isEdit]);

  useEffect(() => {
    if (!autosaveReady || !isDraft) return;
    const hasContent =
      form.title.trim() ||
      form.description.trim() ||
      form.questions.some((q) => q.text.trim() || q.help_text.trim());
    if (!hasContent) return;
    const handle = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem(autosaveKey, JSON.stringify({ form, savedAt }));
      setAutosavedAt(savedAt);
    }, 700);
    return () => window.clearTimeout(handle);
  }, [autosaveKey, autosaveReady, form, isDraft]);

  const validate = () => {
    const e: Record<string, string> = { ...validateQuestions(form.questions) };
    if (!form.title.trim()) e.title = "عنوان الزامی است";

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
        comment_required: question.has_comment
          ? question.comment_required
          : false,
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
        toast.success("تغییرات ذخیره شد");
        navigate(`/admin/surveys/${id}`);
      } else {
        const r = await adminSurveyApi.create(payload());
        localStorage.removeItem(autosaveKey);
        toast.success("نظرسنجی ایجاد شد");
        navigate(`/admin/surveys/${r.data.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const set =
    (field: "title" | "description") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      if (errors[field]) setErrors((er) => ({ ...er, [field]: "" }));
    };

  const setQuestions = (questions: SurveyQuestionInput[]) => {
    setForm((f) => ({ ...f, questions }));
  };

  const clearErrorKey = (key: string) => {
    setErrors((er) => {
      if (!(key in er)) return er;
      const next = { ...er };
      delete next[key];
      return next;
    });
  };

  const clearAutosave = () => {
    localStorage.removeItem(autosaveKey);
    setAutosavedAt(null);
    toast.success("پیش‌نویس ذخیره‌شده پاک شد");
  };

  const openPreview = () => {
    if (!validate()) return;
    setPreviewOpen(true);
  };

  if (loading) return <FormSkeleton />;

  return (
    <div className="responsive-page max-w-3xl">
      <PageHeader
        title={isEdit ? "ویرایش نظرسنجی" : "نظرسنجی جدید"}
        subtitle={
          isEdit
            ? isDraft
              ? "اطلاعات و سوال‌های نظرسنجی را ویرایش کنید"
              : "فقط عنوان و توضیحات قابل ویرایش است. سوال‌ها و افراد در حالت منتشرشده قفل هستند."
            : "سوال‌های چندگانه برای همه افراد نظرسنجی تعریف کنید"
        }
      />

      <form onSubmit={handleSubmit} className="card p-4 sm:p-6 space-y-6">
        {isDraft && (
          <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                ذخیره خودکار پیش‌نویس فعال است
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                {autosavedAt
                  ? `آخرین ذخیره: ${new Date(autosavedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`
                  : "تغییرات فرم روی همین دستگاه نگه داشته می‌شود."}
              </p>
            </div>
            {autosavedAt && (
              <button
                type="button"
                onClick={clearAutosave}
                className="btn-secondary w-full min-[420px]:w-auto text-xs"
              >
                پاک کردن ذخیره محلی
              </button>
            )}
          </div>
        )}
        {!isDraft && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              ساختار این نظرسنجی قفل است
            </p>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              بعد از انتشار یا بستن، سوال‌ها و افراد برای حفظ اعتبار پاسخ‌ها
              تغییر نمی‌کنند. در این صفحه فقط عنوان و توضیحات ذخیره می‌شود.
            </p>
          </div>
        )}
        <div>
          <label className="label">
            عنوان نظرسنجی <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={set("title")}
            className={`input-field ${errors.title ? "border-red-400" : ""}`}
            placeholder="مثال: نظرسنجی ارزیابی عملکرد کارکنان"
          />
          {errors.title && (
            <p className="text-xs text-red-500 mt-1">{errors.title}</p>
          )}
        </div>
        <div>
          <label className="label">توضیحات / راهنمای شرکت‌کنندگان</label>
          <textarea
            value={form.description}
            onChange={set("description")}
            rows={3}
            className="input-field resize-none"
            placeholder="توضیحات یا راهنمایی برای شرکت‌کنندگان..."
          />
        </div>
        {isDraft && (
          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs text-gray-400 mb-4">
              کاربر برای هر فرد باید به همه سوال‌های فعال پاسخ بدهد.
            </p>
            <QuestionsEditor
              questions={form.questions}
              onChange={setQuestions}
              errors={errors}
              onClearError={clearErrorKey}
            />
          </div>
        )}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full sm:w-auto flex items-center gap-2"
          >
            {saving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isEdit ? "ذخیره تغییرات" : "ایجاد نظرسنجی"}
          </button>
          {isDraft && (
            <button
              type="button"
              onClick={openPreview}
              className="btn-secondary w-full sm:w-auto"
            >
              پیش‌نمایش
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary w-full sm:w-auto"
          >
            انصراف
          </button>
        </div>{" "}
      </form>
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="پیش‌نمایش نظرسنجی"
        size="lg"
      >
        <div className="p-4 sm:p-6 space-y-5" dir="rtl">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-400 mb-2">
              نمای شرکت‌کننده
            </p>
            <h2 className="text-lg font-bold text-slate-800 leading-snug">
              {form.title || "عنوان نظرسنجی"}
            </h2>
            {form.description && (
              <p className="text-sm text-gray-500 leading-relaxed mt-2">
                {form.description}
              </p>
            )}
          </div>
          <div className="space-y-3">
            {form.questions.map((question, index) => (
              <div
                key={index}
                className="rounded-2xl border border-gray-100 p-4"
              >
                <p className="text-sm font-bold text-slate-800">
                  {formatNumber(index + 1)}. {question.text}
                </p>
                {question.help_text && (
                  <p className="text-xs text-gray-400 mt-1">
                    {question.help_text}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {question.has_score && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                      امتیاز عددی{" "}
                      {question.score_required ? "الزامی" : "اختیاری"}
                    </span>
                  )}
                  {question.has_emoji && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                      ایموجی {question.emoji_required ? "الزامی" : "اختیاری"}
                    </span>
                  )}
                  {question.has_comment && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      توضیح {question.comment_required ? "الزامی" : "اختیاری"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="btn-primary"
            >
              بستن پیش‌نمایش
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
