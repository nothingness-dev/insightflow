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

interface QuestionsEditorProps {
  questions: SurveyQuestionInput[];
  onChange: (questions: SurveyQuestionInput[]) => void;
  errors?: Record<string, string>;
  onClearError?: (key: string) => void;
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

export default function QuestionsEditor({
  questions,
  onChange,
  errors = {},
  onClearError,
}: QuestionsEditorProps) {
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
  };

  const removeQuestion = (index: number) => {
    onChange(
      questions.length === 1
        ? questions
        : questions
            .filter((_, i) => i !== index)
            .map((q, i) => ({ ...q, display_order: i })),
    );
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

      <div className="space-y-4">
        {questions.map((question, index) => (
          <div
            key={question.id || index}
            className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-slate-700">
                سوال {formatNumber(index + 1)}
              </p>
              <button
                type="button"
                onClick={() => removeQuestion(index)}
                disabled={questions.length === 1}
                className="text-xs font-medium text-red-500 disabled:text-gray-300"
              >
                حذف
              </button>
            </div>

            <textarea
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
        ))}
      </div>
    </div>
  );
}
