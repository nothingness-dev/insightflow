import { useState, useRef, useEffect, useCallback } from 'react';
import { formatNumber, toPersianDigits } from '../../utils/helpers';


function g2j(gy: number, gm: number, gd: number): [number, number, number] {
  const leap = [0,31,59,90,120,151,181,212,243,273,304,334];
  let y = gy-1600, m = gm-1, d = gd-1;
  let dn = 365*y + Math.floor((y+3)/4) - Math.floor((y+99)/100) + Math.floor((y+399)/400);
  for (let i=0;i<m;i++) dn+=leap[i];
  if (m>1 && ((y%4===0&&y%100!==0)||y%400===0)) dn++;
  dn+=d;
  let jdn = dn-79;
  const np = Math.floor(jdn/12053); jdn%=12053;
  let jy = 979+33*np+4*Math.floor(jdn/1461); jdn%=1461;
  if (jdn>=366){jy+=Math.floor((jdn-1)/365); jdn=(jdn-1)%365;}
  const ja=[0,31,60,91,121,152,182,213,244,274,305,335];
  let jm=0,jd=0;
  for(let i=11;i>=0;i--){if(jdn>=ja[i]){jm=i+1;jd=jdn-ja[i]+1;break;}}
  return [jy,jm,jd];
}

function j2g(jy: number, jm: number, jd: number): [number, number, number] {
  jy+=1595;
  let days=-355779+365*jy+Math.floor(jy/33)*8+Math.floor(((jy%33)+3)/4);
  if(jm<=6) days+=(jm-1)*31; else days+=(jm-7)*30+186;
  days+=jd;
  let gy=400*Math.floor(days/146097); days%=146097;
  if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++;}
  gy+=4*Math.floor(days/1461); days%=1461;
  if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365;}
  const sal=[0,31,(gy%4===0&&gy%100!==0)||gy%400===0?29:28,31,30,31,30,31,31,30,31,30,31];
  let gm=0,gd=0;
  for(let i=1;i<=12;i++){if(days<sal[i]){gm=i;gd=days+1;break;}days-=sal[i];}
  return [gy,gm,gd];
}

function monthLen(jy: number, jm: number): number {
  if (jm<=6) return 31;
  if (jm<=11) return 30;
  const r = ((jy-474)%2820+474+38)%2820%33;
  return [1,5,9,13,17,22,26,30].includes(r-1) ? 30 : 29;
}


function emit(jy: number, jm: number, jd: number, h: number, m: number): string {
  const [gy,gm,gd] = j2g(jy,jm,jd);
  return `${gy}-${z(gm)}-${z(gd)}T${z(h)}:${z(m)}`;
}


function parse(iso: string) {
  if (!iso) return null;

  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [gy,gm,gd,h,mn] = m.slice(1).map(Number);
  const [jy,jm,jd] = g2j(gy,gm,gd);
  return { jy, jm, jd, h, m: mn };
}

function z(n: number) { return String(n).padStart(2,'0'); }

function todayJ(): [number,number,number] {
  const n = new Date();
  return g2j(n.getFullYear(), n.getMonth()+1, n.getDate());
}

function isPast(jy: number, jm: number, jd: number) {
  const [ty,tm,td] = todayJ();
  return jy<ty || (jy===ty && jm<tm) || (jy===ty && jm===tm && jd<td);
}

const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const WDAYS  = ['ش','ی','د','س','چ','پ','ج'];

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
  minToday?: boolean;
}

export default function PersianDatePicker({ value, onChange, placeholder='انتخاب تاریخ', hasError, minToday=true }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);


  const parsed = parse(value);


  const [ty,tm] = todayJ();
  const [viewY, setViewY] = useState(() => parsed?.jy ?? ty);
  const [viewM, setViewM] = useState(() => parsed?.jm ?? tm);


  const [selY, setSelY] = useState<number|null>(() => parsed?.jy ?? null);
  const [selM, setSelM] = useState<number|null>(() => parsed?.jm ?? null);
  const [selD, setSelD] = useState<number|null>(() => parsed?.jd ?? null);


  const [hour, setHour] = useState(() => parsed?.h ?? 8);
  const [min,  setMin]  = useState(() => parsed?.m ?? 0);


  useEffect(() => {
    const p = parse(value);
    if (p) {
      setViewY(p.jy); setViewM(p.jm);
      setSelY(p.jy); setSelM(p.jm); setSelD(p.jd);
      setHour(p.h); setMin(p.m);
    } else {
      setSelY(null); setSelM(null); setSelD(null);
    }
  }, [value]);


  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);


  const emitIfSelected = useCallback((sy: number|null, sm: number|null, sd: number|null, h: number, m: number) => {
    if (sy !== null && sm !== null && sd !== null) {
      onChange(emit(sy, sm, sd, h, m));
    }
  }, [onChange]);


  const totalDays  = monthLen(viewY, viewM);
  const [gy1,gm1,gd1] = j2g(viewY, viewM, 1);
  const firstDow   = new Date(gy1, gm1-1, gd1).getDay();
  const startOff   = (firstDow + 1) % 7;

  const clickDay = (day: number) => {
    setSelY(viewY); setSelM(viewM); setSelD(day);
    onChange(emit(viewY, viewM, day, hour, min));
  };

  const adjHour = (delta: number) => {
    const h = (hour + delta + 24) % 24;
    setHour(h);
    emitIfSelected(selY, selM, selD, h, min);
  };

  const adjMin = (delta: number) => {
    const m = (min + delta + 60) % 60;
    setMin(m);
    emitIfSelected(selY, selM, selD, hour, m);
  };

  const prevM = () => { if(viewM===1){setViewY(y=>y-1);setViewM(12);}else setViewM(m=>m-1); };
  const nextM = () => { if(viewM===12){setViewY(y=>y+1);setViewM(1);}else setViewM(m=>m+1); };

  const [ty2,tm2] = todayJ();
  const canPrev = !(minToday && (viewY<ty2 || (viewY===ty2 && viewM<=tm2)));


  const display = (selY !== null && selM !== null && selD !== null)
    ? `${selY}/${z(selM)}/${z(selD)}   ${z(hour)}:${z(min)}`
    : '';

  return (
    <div ref={containerRef} className="relative" dir="rtl">
<div
        onClick={() => setOpen(o => !o)}
        className={`input-field flex items-center justify-between cursor-pointer select-none
          ${hasError ? 'border-red-400 focus:ring-red-400' : ''}`}
      >
        <span className={display ? 'text-slate-700 font-medium' : 'text-gray-400'}>
          {display || placeholder}
        </span>
        <div className="flex items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); setSelY(null); setSelM(null); setSelD(null); }}
              className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
      </div>
{open && (
        <div className="absolute top-full mt-2 right-0 z-50 w-[min(300px,calc(100vw-2rem))] max-w-full bg-white rounded-2xl shadow-2xl border border-purple-100 p-3 sm:p-4 select-none">
<div className="flex items-center justify-between mb-3">
            <button type="button" onClick={nextM}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <span className="text-sm font-bold text-slate-800">
              {MONTHS[viewM-1]} <span className="text-purple-600">{formatNumber(viewY)}</span>
            </span>
            <button type="button" onClick={prevM} disabled={!canPrev}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-purple-50 text-gray-500 hover:text-purple-700 transition-colors disabled:opacity-25 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
<div className="grid grid-cols-7 mb-1">
            {WDAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-purple-400 py-1">{d}</div>
            ))}
          </div>
<div className="grid grid-cols-7 gap-0.5">
            {Array.from({length: startOff}).map((_,i) => <div key={`e${i}`}/>)}
            {Array.from({length: totalDays}).map((_,i) => {
              const day = i + 1;
              const past = minToday && isPast(viewY, viewM, day);
              const [ty3,tm3,td3] = todayJ();
              const isToday    = viewY===ty3 && viewM===tm3 && day===td3;
              const isSelected = selY===viewY && selM===viewM && selD===day;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={past}
                  onClick={() => clickDay(day)}
                  className={[
                    'w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-all duration-100 font-medium',
                    past       ? 'text-gray-300 cursor-not-allowed'
                    : isSelected ? 'bg-purple-600 text-white shadow-md'
                    : isToday    ? 'bg-purple-100 text-purple-700 font-bold'
                    :              'hover:bg-purple-50 text-slate-700 hover:text-purple-700',
                  ].join(' ')}
                >
                  {formatNumber(day)}
                </button>
              );
            })}
          </div>
<div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-2">زمان (ساعت : دقیقه)</p>
            <div className="flex items-center justify-center gap-4">
<div className="flex flex-col items-center gap-1">
                <button type="button" onClick={() => adjHour(1)}
                  className="w-8 h-8 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg leading-none transition-colors">
                  ＋
                </button>
                <div className="w-14 h-10 border-2 border-purple-200 rounded-xl flex items-center justify-center text-base font-bold text-slate-800 bg-white">
                  {toPersianDigits(z(hour))}
                </div>
                <button type="button" onClick={() => adjHour(-1)}
                  className="w-8 h-8 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg leading-none transition-colors">
                  －
                </button>
                <span className="text-xs text-gray-400">ساعت</span>
              </div>

              <span className="text-2xl font-bold text-purple-300 mb-5">:</span>
<div className="flex flex-col items-center gap-1">
                <button type="button" onClick={() => adjMin(5)}
                  className="w-8 h-8 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg leading-none transition-colors">
                  ＋
                </button>
                <div className="w-14 h-10 border-2 border-purple-200 rounded-xl flex items-center justify-center text-base font-bold text-slate-800 bg-white">
                  {toPersianDigits(z(min))}
                </div>
                <button type="button" onClick={() => adjMin(-5)}
                  className="w-8 h-8 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg leading-none transition-colors">
                  －
                </button>
                <span className="text-xs text-gray-400">دقیقه</span>
              </div>
            </div>
          </div>
<button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 w-full py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-sm"
          >
            تأیید
          </button>
        </div>
      )}
    </div>
  );
}
