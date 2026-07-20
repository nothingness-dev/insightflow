import { useEffect, useRef, useState } from "react";
import { SurveyQuestionInput } from "../../types";
import { formatNumber } from "../../utils/helpers";

export const createEmptyQuestion = (displayOrder: number): SurveyQuestionInput => ({
  text: "",
  help_text: "",
  has_score: true,
  score_required: true,
  has_comment: false,
  comment_required: false,
  has_emoji: false,
  emoji_required: false,
  display_order: displayOrder,
  is_active: true,
});

export interface QuestionFocusRequest {
  index: number;
  field: "text" | "type";
  nonce: number;
}

interface QuestionsEditorProps {
  questions: SurveyQuestionInput[];
  onChange: (questions: SurveyQuestionInput[]) => void;
  errors?: Record<string, string>;
  onClearError?: (key: string) => void;
  focusRequest?: QuestionFocusRequest | null;
}

export function validateQuestions(questions: SurveyQuestionInput[]) {
  const e: Record<string, string> = {};
  if (questions.length === 0) e.questions = "حداقل یک سوال الزامی است";

  questions.forEach((question, index) => {
    if (!question.text.trim()) e[`question_${index}`] = "متن سوال الزامی است";
    if (!question.has_score && !question.has_comment && !question.has_emoji) {
      e[`question_type_${index}`] =
        "هر سوال باید حداقل یک نوع پاسخ (امتیاز عددی، امتیاز ایموجی یا توضیح متنی) داشته باشد";
    }
    if (!question.has_score && question.score_required) {
      e[`question_type_${index}`] =
        "وقتی امتیاز غیرفعال است، نمی‌تواند الزامی باشد";
    }
    if (!question.has_comment && question.comment_required) {
      e[`question_type_${index}`] =
        "وقتی توضیح غیرفعال است، نمی‌تواند الزامی باشد";
    }
    if (!question.has_emoji && question.emoji_required) {
      e[`question_type_${index}`] =
        "وقتی امتیاز ایموجی غیرفعال است، نمی‌تواند الزامی باشد";
    }
  });

  return e;
}

export function questionTypeSummary(question: SurveyQuestionInput) {
  const parts: string[] = [];
  if (question.has_score)
    parts.push(`امتیاز عددی ${question.score_required ? "الزامی" : "اختیاری"}`);
  if (question.has_emoji)
    parts.push(`ایموجی ${question.emoji_required ? "الزامی" : "اختیاری"}`);
  if (question.has_comment)
    parts.push(`توضیح ${question.comment_required ? "الزامی" : "اختیاری"}`);
  return parts.length ? parts.join(" · ") : "بدون نوع پاسخ";
}

export default function QuestionsEditor({
  questions,
  onChange,
  errors = {},
  onClearError,
  focusRequest = null,
}: QuestionsEditorProps) {
  // Questions that already have text start collapsed so a long survey reads
  // as accordion rows instead of a wall of permanently open forms.
  const [collapsed, setCollapsed] = useState<boolean[]>(() =>
    questions.map((q) => !!q.text.trim()),
  );
  const textRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const typeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // The list can be replaced from outside after mount (edit-mode load,
  // autosave restore); re-derive the collapsed state when the size changes.
  useEffect(() => {
    setCollapsed((cur) =>
      cur.length === questions.length
        ? cur
        : questions.map((q) => !!q.text.trim()),
    );
  }, [questions]);

  useEffect(() => {
    if (!focusRequest) return;
    const { index, field } = focusRequest;
    setCollapsed((cur) => {
      const base =
        cur.length === questions.length
          ? cur
          : questions.map((q) => !!q.text.trim());
      return base.map((value, i) => (i === index ? false : value));
    });
    // Focus after the expanded body has rendered.
    const handle = window.setTimeout(() => {
      const control =
        field === "type" ? typeRefs.current[index] : textRefs.current[index];
      (control ?? cardRefs.current[index])?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      control?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const updateQuestion = (index: number, patch: Partial<SurveyQuestionInput>) => {
    onChange(
      questions.map((question, i) => {
        if (i !== index) return question;
        const next = { ...question, ...patch };
        if (!next.has_score) next.score_required = false;
        if (!next.has_comment) next.comment_required = false;
        if (!next.has_emoji) next.emoji_required = false;
        return next;
      }),
    );
    onClearError?.(`question_${index}`);
    onClearError?.(`question_type_${index}`);
    onClearError?.("questions");
  };

  const addQuestion = () => {
    onChange([...questions, createEmptyQuestion(questions.length)]);
    // Entered questions fold into accordion rows; the new one opens for editing.
    setCollapsed([...questions.map((q) => !!q.text.trim()), false]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    onChange(
      questions
        .filter((_, i) => i !== index)
        .map((q, i) => ({ ...q, display_order: i })),
    );
    setCollapsed((cur) => cur.filter((_, i) => i !== index));
  };

  const toggleCollapsed = (index: number) => {
    setCollapsed((cur) => {
      const base =
        cur.length === questions.length
          ? cur
          : questions.map((q) => !!q.text.trim());
      return base.map((value, i) => (i === index ? !value : value));
    });
  };

  return (
    <div>
      <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-slate-800">سوال‌ها</h2>
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="btn-secondary w-full min-[420px]:w-auto text-sm"
        >
          افزودن سوال
        </button>
      </div>
      {errors.questions && (
        <p className="text-xs text-red-500 mb-3">{errors.questions}</p>
      )}

      <div className="space-y-3">
        {questions.map((question, index) => {
          const isCollapsed = collapsed[index] ?? false;
          const hasError = !!(
            errors[`question_${index}`] || errors[`question_type_${index}`]
          );
          return (
            <div
              key={question.id || index}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              className={`rounded-2xl border bg-gray-50/60 ${hasError ? "border-red-200" : "border-gray-100"}`}
            >
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(index)}
                  aria-expanded={!isCollapsed}
                  className="flex flex-1 items-center gap-2 min-w-0 text-right"
                >
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-150 ${isCollapsed ? "" : "rotate-180"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-700">
                        سوال {formatNumber(index + 1)}
                        {isCollapsed && (
                          <span className="font-normal text-gray-400">
                            {" "}· {questionTypeSummary(question)}
                          </span>
                        )}
                      </span>
                      {hasError && (
                        <span className="flex-shrink-0 text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                          نیازمند اصلاح
                        </span>
                      )}
                    </span>
                    {isCollapsed && (
                      <span className="block text-xs text-gray-400 truncate mt-0.5">
                        {question.text.trim() || "بدون متن سوال"}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  disabled={questions.length === 1}
                  className="flex-shrink-0 text-xs font-medium text-red-500 disabled:text-gray-300"
                >
                  حذف
                </button>
              </div>

              {!isCollapsed && (
                <div className="px-4 pb-4">
                  <textarea
                    ref={(el) => {
                      textRefs.current[index] = el;
                    }}
                    value={question.text}
                    onChange={(e) => updateQuestion(index, { text: e.target.value })}
                    rows={2}
                    className={`input-field resize-none bg-white ${errors[`question_${index}`] ? "border-red-400" : ""}`}
                    placeholder="مثال: کیفیت همکاری این فرد را چگونه ارزیابی می‌کنید؟"
                  />
                  {errors[`question_${index}`] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors[`question_${index}`]}
                    </p>
                  )}

                  <input
                    value={question.help_text}
                    onChange={(e) => updateQuestion(index, { help_text: e.target.value })}
                    className="input-field bg-white mt-3"
                    placeholder="راهنمای اختیاری برای این سوال"
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <div className="rounded-xl bg-white border border-gray-100 p-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          ref={(el) => {
                            typeRefs.current[index] = el;
                          }}
                          checked={question.has_score}
                          onChange={(e) => updateQuestion(index, { has_score: e.target.checked })}
                        />
                        امتیاز عددی ۱ تا ۱۰
                      </label>
                      {question.has_score && (
                        <label className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                          <input
                            type="checkbox"
                            checked={question.score_required}
                            onChange={(e) => updateQuestion(index, { score_required: e.target.checked })}
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
                          onChange={(e) => updateQuestion(index, { has_emoji: e.target.checked })}
                        />
                        امتیاز ایموجی (بد تا عالی)
                      </label>
                      {question.has_emoji && (
                        <label className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                          <input
                            type="checkbox"
                            checked={question.emoji_required}
                            onChange={(e) => updateQuestion(index, { emoji_required: e.target.checked })}
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
                          onChange={(e) => updateQuestion(index, { has_comment: e.target.checked })}
                        />
                        کادر توضیح متنی
                      </label>
                      {question.has_comment && (
                        <label className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                          <input
                            type="checkbox"
                            checked={question.comment_required}
                            onChange={(e) => updateQuestion(index, { comment_required: e.target.checked })}
                          />
                          توضیح متنی الزامی باشد
                        </label>
                      )}
                    </div>
                  </div>

                  {errors[`question_type_${index}`] && (
                    <p className="text-xs text-red-500 mt-2">
                      {errors[`question_type_${index}`]}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        className="mt-3 w-full rounded-2xl border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 hover:border-[color:var(--c-300)] hover:text-[color:var(--c-600)] transition-colors"
      >
        + افزودن سوال
      </button>
    </div>
  );
}
