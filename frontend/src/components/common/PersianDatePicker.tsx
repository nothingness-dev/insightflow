/**
 * PersianDatePicker — a compact Jalali calendar picker.
 * Value/onChange use ISO-8601 UTC strings (same format as datetime-local).
 * Internally converts between Gregorian and Jalali using lightweight math.
 */

import { useState, useRef, useEffect } from 'react';

// ─── Jalali conversion helpers ───────────────────────────────────────────────

function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_no = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number, jm: number, jd: number;
  let g_y = gy - 1600;
  let g_m = gm - 1;
  let g_d = gd - 1;
  let g_d_no2 = 365 * g_y + Math.floor((g_y + 3) / 4) - Math.floor((g_y + 99) / 100) + Math.floor((g_y + 399) / 400);
  for (let i = 0; i < g_m; ++i) g_d_no2 += g_d_no[i];
  if (g_m > 1 && ((g_y % 4 === 0 && g_y % 100 !== 0) || g_y % 400 === 0)) g_d_no2++;
  g_d_no2 += g_d;
  let j_d_no = g_d_no2 - 79;
  let j_np = Math.floor(j_d_no / 12053);
  j_d_no %= 12053;
  jy = 979 + 33 * j_np + 4 * Math.floor(j_d_no / 1461);
  j_d_no %= 1461;
  if (j_d_no >= 366) { jy += Math.floor((j_d_no - 1) / 365); j_d_no = (j_d_no - 1) % 365; }
  const j_d_no_arr = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  jm = 0;
  for (let i = 11; i >= 0; i--) { if (j_d_no >= j_d_no_arr[i]) { jm = i + 1; jd = j_d_no - j_d_no_arr[i] + 1; break; } }
  jd = jd!;
  return [jy, jm, jd];
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  jy += 1595;
  let days = -355779 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4);
  if (jm <= 6) days += (jm - 1) * 31;
  else days += (jm - 7) * 30 + 186;
  days += jd;
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0, gd = 0;
  for (let i = 1; i <= 12; i++) { if (days < sal_a[i]) { gm = i; gd = days + 1; break; } days -= sal_a[i]; }
  return [gy, gm, gd];
}

function jalaliDaysInMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Month 12: 29 in common years, 30 in leap
  const [gy] = jalaliToGregorian(jy, 12, 29);
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  // Simple Jalali leap: years whose remainder mod 2820... use a simpler heuristic
  const leapYears = [1, 5, 9, 13, 17, 22, 26, 30];
  return leapYears.includes(((jy - 474) % 2820 + 474 + 38) % 2820 % 33 - 1) ? 30 : 29;
}

const JALALI_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const JALALI_DAYS  = ['ش','ی','د','س','چ','پ','ج']; // شنبه to جمعه

function pad(n: number) { return String(n).padStart(2, '0'); }

function isoToJalali(iso: string): { jy: number; jm: number; jd: number; hour: number; min: number } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { jy, jm, jd, hour: d.getHours(), min: d.getMinutes() };
  } catch { return null; }
}

function jalaliToIso(jy: number, jm: number, jd: number, hour: number, min: number): string {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return `${gy}-${pad(gm)}-${pad(gd)}T${pad(hour)}:${pad(min)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  value: string; // ISO datetime-local or ''
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
}

export default function PersianDatePicker({ value, onChange, placeholder = 'انتخاب تاریخ', hasError }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const parsed = isoToJalali(value);
  const now = new Date();
  const [nJy, nJm] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const [viewYear, setViewYear] = useState<number>(parsed?.jy ?? nJy);
  const [viewMonth, setViewMonth] = useState<number>(parsed?.jm ?? nJm);
  const [hour, setHour] = useState<number>(parsed?.hour ?? 0);
  const [min, setMin] = useState<number>(parsed?.min ?? 0);

  // Keep hour/min in sync when value changes externally
  useEffect(() => {
    const p = isoToJalali(value);
    if (p) { setViewYear(p.jy); setViewMonth(p.jm); setHour(p.hour); setMin(p.min); }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const daysInMonth = jalaliDaysInMonth(viewYear, viewMonth);

  // Weekday of the 1st of this Jalali month (0=شنبه … 6=جمعه)
  const [gy1, gm1, gd1] = jalaliToGregorian(viewYear, viewMonth, 1);
  const rawDow = new Date(gy1, gm1 - 1, gd1).getDay(); // 0=Sun
  // Convert JS dow (0=Sun) to Jalali week (0=Sat)
  const startOffset = (rawDow + 1) % 7; // Sat=0, Sun=1, ...

  const selectDay = (day: number) => {
    onChange(jalaliToIso(viewYear, viewMonth, day, hour, min));
  };

  const applyTime = (h: number, m: number) => {
    if (parsed) onChange(jalaliToIso(parsed.jy, parsed.jm, parsed.jd, h, m));
  };

  const prevMonth = () => { if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); } else setViewMonth(m => m + 1); };

  const displayValue = parsed
    ? `${parsed.jy}/${pad(parsed.jm)}/${pad(parsed.jd)}  ${pad(parsed.hour)}:${pad(parsed.min)}`
    : '';

  return (
    <div ref={ref} className="relative" dir="rtl">
      <div
        className={`input-field flex items-center justify-between cursor-pointer select-none ${hasError ? 'border-red-400 focus:ring-red-400' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={displayValue ? 'text-slate-700' : 'text-gray-400'}>{displayValue || placeholder}</span>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); }}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-72 select-none">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-semibold text-slate-700">{JALALI_MONTHS[viewMonth - 1]} {viewYear}</span>
            <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {JALALI_DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startOffset }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected = parsed?.jy === viewYear && parsed?.jm === viewMonth && parsed?.jd === day;
              const isToday = nJy === viewYear && nJm === viewMonth && day === gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate())[2];
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-colors
                    ${isSelected ? 'bg-blue-600 text-white font-semibold shadow' :
                      isToday ? 'bg-blue-50 text-blue-700 font-semibold' :
                      'hover:bg-gray-100 text-slate-700'}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time picker */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-center gap-2">
            <span className="text-xs text-gray-500">ساعت:</span>
            <input
              type="number" min={0} max={23} value={pad(hour)}
              onChange={e => { const h = Math.max(0, Math.min(23, Number(e.target.value))); setHour(h); applyTime(h, min); }}
              className="w-14 text-center border border-gray-200 rounded-lg text-sm py-1 px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400">:</span>
            <input
              type="number" min={0} max={59} value={pad(min)}
              onChange={e => { const m = Math.max(0, Math.min(59, Number(e.target.value))); setMin(m); applyTime(hour, m); }}
              className="w-14 text-center border border-gray-200 rounded-lg text-sm py-1 px-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Done */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            تأیید
          </button>
        </div>
      )}
    </div>
  );
}
