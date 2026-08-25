import { EmojiRatingValue, SurveyQuestion } from '../../types';

export function getQuestionTypeLabel(q: SurveyQuestion) {
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

export const EMOJI_OPTIONS: { value: EmojiRatingValue; label: string; Icon: () => JSX.Element; selectedClass: string; idleClass: string }[] = [
  { value: 'bad', label: 'ضعیف', Icon: BadFaceIcon, selectedClass: 'bg-red-500 border-red-500 text-white ring-2 ring-red-200 ring-offset-1', idleClass: 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' },
  { value: 'average', label: 'متوسط', Icon: AverageFaceIcon, selectedClass: 'bg-amber-500 border-amber-500 text-white ring-2 ring-amber-200 ring-offset-1', idleClass: 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' },
  { value: 'good', label: 'خوب', Icon: GoodFaceIcon, selectedClass: 'bg-lime-500 border-lime-500 text-white ring-2 ring-lime-200 ring-offset-1', idleClass: 'bg-lime-50 border-lime-200 text-lime-700 hover:bg-lime-100' },
  { value: 'excellent', label: 'عالی', Icon: ExcellentFaceIcon, selectedClass: 'bg-emerald-500 border-emerald-500 text-white ring-2 ring-emerald-200 ring-offset-1', idleClass: 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' },
];

/**
 * Shared emoji rating grid used by both the anonymous voting flow and the
 * employee survey flow - previously copy-pasted in both pages, which risked
 * accessibility and validation drift between them.
 */
export default function EmojiRatingPicker({ value, onChange }: { value: EmojiRatingValue | null; onChange: (v: EmojiRatingValue) => void }) {
  return (
    <div className="rating-emoji-grid grid gap-1.5 sm:gap-2">
      {EMOJI_OPTIONS.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            aria-label={`امتیاز کیفی: ${opt.label}`}
            className={`relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2.5 text-xs font-bold transition-[background-color,border-color,color,box-shadow] duration-150 ${selected ? opt.selectedClass : opt.idleClass}`}
          >
            {selected && (
              <span className="absolute end-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white/90 text-slate-700" aria-hidden="true">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
            <opt.Icon />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
