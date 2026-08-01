import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminSurveyApi } from "../../api/endpoints";
import { Survey, SurveyQuestionInput } from "../../types";
import { Modal, PageHeader, FormSkeleton } from "../../components/common/index";
import { formatNumber, getErrorMessage } from "../../utils/helpers";
import { isCanceledRequest } from "../../utils/http";
import toast from "react-hot-toast";
import QuestionsEditor, {
  createEmptyQuestion,
  normalizeQuestionRequirements,
  validateQuestions,
  QuestionFocusRequest,
} from "../../components/admin/QuestionsEditor";

const AUTOSAVE_NOTICE_KEY = "InsightFlow:autosave-notice-seen";

const QUESTION_ERROR_RE = /^question(_type)?_(\d+)$/;

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
  // The big green explainer is shown until the admin has seen it once; after
  // that the form only keeps a subtle status row + the sticky-bar timestamp.
  const [showAutosaveIntro] = useState(
    () => localStorage.getItem(AUTOSAVE_NOTICE_KEY) !== "1",
  );
  const [focusRequest, setFocusRequest] = useState<QuestionFocusRequest | null>(
    null,
  );
  const focusNonce = useRef(0);
  const titleRef = useRef<HTMLInputElement | null>(null);
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
              .map((q, index) => normalizeQuestionRequirements({
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
    if (loading || !isDraft || !showAutosaveIntro) return;
    localStorage.setItem(AUTOSAVE_NOTICE_KEY, "1");
  }, [loading, isDraft, showAutosaveIntro]);

  useEffect(() => {
    if (isEdit || autosaveReady) return;
    const raw = localStorage.getItem(autosaveKey);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (saved?.form) {
          const savedQuestions = Array.isArray(saved.form.questions)
            ? saved.form.questions.map(normalizeQuestionRequirements)
            : [createEmptyQuestion(0)];
          setForm({ ...saved.form, questions: savedQuestions });
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

  const formatSavedTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const focusErrorKey = (key: string) => {
    if (key === "title") {
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      titleRef.current?.focus({ preventScroll: true });
      return;
    }
    const match = key.match(QUESTION_ERROR_RE);
    if (match) {
      setFocusRequest({
        index: Number(match[2]),
        field: match[1] ? "type" : "text",
        nonce: ++focusNonce.current,
      });
    }
  };

  const focusFirstError = (e: Record<string, string>) => {
    if (e.title) {
      focusErrorKey("title");
      return;
    }
    let first: { index: number; field: "text" | "type" } | null = null;
    for (const key of Object.keys(e)) {
      const match = key.match(QUESTION_ERROR_RE);
      if (!match) continue;
      const index = Number(match[2]);
      const field: "text" | "type" = match[1] ? "type" : "text";
      if (
        !first ||
        index < first.index ||
        (index === first.index && field === "text" && first.field === "type")
      ) {
        first = { index, field };
      }
    }
    if (first) {
      setFocusRequest({ ...first, nonce: ++focusNonce.current });
    }
  };

  const validate = () => {
    const e: Record<string, string> = { ...validateQuestions(form.questions) };
    if (!form.title.trim()) e.title = "عنوان الزامی است";

    setErrors(e);
    if (Object.keys(e).length > 0) focusFirstError(e);
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
      questions: form.questions.map((question, index) =>
        normalizeQuestionRequirements({
          ...question,
          text: question.text.trim(),
          help_text: question.help_text.trim(),
          display_order: index,
          is_active: true,
        }),
      ),
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

  const errorSummary = Object.entries(errors)
    .filter(([, message]) => message)
    .map(([key, message]) => {
      const match = key.match(QUESTION_ERROR_RE);
      const label =
        key === "title"
          ? "عنوان نظرسنجی"
          : match
            ? `سوال ${formatNumber(Number(match[2]) + 1)}`
            : "سوال‌ها";
      const order =
        key === "title" ? -1 : match ? Number(match[2]) : Number.MAX_SAFE_INTEGER;
      return { key, label, message, order };
    })
    .sort((a, b) => a.order - b.order);

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

      <form onSubmit={handleSubmit}>
        {errorSummary.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700 mb-1.5">
              برای ادامه، {formatNumber(errorSummary.length)} مورد را اصلاح
              کنید:
            </p>
            <ul className="space-y-1">
              {errorSummary.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => focusErrorKey(item.key)}
                    className="text-right text-xs text-red-600 hover:text-red-800 hover:underline"
                  >
                    <span className="font-semibold">{item.label}:</span>{" "}
                    {item.message}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="card p-4 sm:p-6 space-y-6">
          {isDraft && showAutosaveIntro && (
            <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  ذخیره خودکار پیش‌نویس فعال است
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  {autosavedAt
                    ? `آخرین ذخیره: ${formatSavedTime(autosavedAt)}`
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
          {isDraft && !showAutosaveIntro && (
            <div className="flex items-center justify-between gap-3 text-xs text-gray-400">
              <p>
                ذخیره خودکار
                {autosavedAt
                  ? ` · آخرین ذخیره ${formatSavedTime(autosavedAt)}`
                  : " فعال است"}
              </p>
              {autosavedAt && (
                <button
                  type="button"
                  onClick={clearAutosave}
                  className="flex-shrink-0 underline hover:text-gray-600"
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
            <label htmlFor="survey-title" className="label">
              عنوان نظرسنجی <span className="text-red-500">*</span>
            </label>
            <input
              id="survey-title"
              ref={titleRef}
              type="text"
              value={form.title}
              onChange={set("title")}
              className={`input-field ${errors.title ? "border-red-400" : ""}`}
              placeholder="مثال: نظرسنجی ارزیابی عملکرد کارکنان"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? "survey-title-error" : undefined}
            />
            {errors.title && (
              <p
                id="survey-title-error"
                role="alert"
                className="text-xs text-red-500 mt-1"
              >
                {errors.title}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="survey-description" className="label">
              توضیحات / راهنمای شرکت‌کنندگان
            </label>
            <textarea
              id="survey-description"
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
                focusRequest={focusRequest}
              />
            </div>
          )}
        </div>

        <div className="safe-sticky-action card sticky z-20 mt-4 px-3 py-2.5 sm:px-4 flex items-center gap-2 sm:gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex-shrink-0 flex items-center gap-2"
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
              className="btn-secondary flex-shrink-0"
            >
              پیش‌نمایش
            </button>
          )}
          <p className="flex-1 min-w-0 truncate text-[11px] sm:text-xs text-gray-400 text-center">
            {isDraft &&
              (autosavedAt
                ? `ذخیره شد · ${formatSavedTime(autosavedAt)}`
                : "ذخیره خودکار فعال")}
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary flex-shrink-0"
          >
            انصراف
          </button>
        </div>
      </form>
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="پیش‌نمایش نظرسنجی"
        size="lg"
        bodyClassName="p-4 sm:p-6"
        footer={(
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="btn-primary w-full sm:w-auto"
          >
            بستن پیش‌نمایش
          </button>
        )}
      >
        <div className="space-y-5" dir="rtl">
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
        </div>
      </Modal>
    </div>
  );
}
