import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme, THEMES, Theme } from '../../contexts/ThemeContext';
import { D, E, T, popover, useMotionDisabled } from '../../motion';

const SWATCH: Record<Theme, string> = {
  purple: '#9333ea',
  blue:   '#2563eb',
  green:  '#059669',
  red:    '#e11d48',
};

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

export default function ThemeSwitcher() {
  const { theme, setTheme, mode, toggleMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isDark = mode === 'dark';
  const reduced = useMotionDisabled();

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <button
        onClick={toggleMode}
        title={isDark ? 'حالت روشن' : 'حالت تاریک'}
        aria-label={isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
        className="icon-button rounded-full border transition-all hover:scale-105 active:scale-95"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border-soft)', color: isDark ? '#fbbf24' : '#64748b' }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode}
            initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -60, scale: 0.5 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 60, scale: 0.5 }}
            transition={reduced ? T.instant : { duration: D.normal / 1000, ease: E.standard }}
            className="flex items-center justify-center"
          >
            {isDark ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
          </motion.span>
        </AnimatePresence>
      </button>

      <button
        onClick={() => setOpen(o => !o)}
        title="تغییر رنگ‌بندی"
        aria-label="باز کردن تنظیمات رنگ‌بندی"
        aria-haspopup="menu"
        aria-expanded={open}
        className="icon-button rounded-full border-2 border-white shadow-md transition-transform hover:scale-105"
        style={{ backgroundColor: SWATCH[theme] }}
      >
        <svg className="w-4 h-4 text-white opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={popover}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={reduced ? T.instant : { duration: D.fast / 1000, ease: E.standard }}
            style={{ transformOrigin: 'top left', backgroundColor: 'var(--surface)', borderColor: 'var(--border-soft)' }}
            className="absolute end-0 top-12 rounded-xl shadow-xl border p-3 z-50 min-w-[176px]"
          >
            <p className="text-xs text-gray-400 mb-2 px-1">حالت نمایش</p>
            <div className="flex gap-1.5 mb-3 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-alt)' }}>
              <button
                onClick={() => { if (isDark) toggleMode(); }}
                className={`min-h-11 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${!isDark ? 'shadow-sm' : ''}`}
                style={!isDark ? { backgroundColor: 'var(--surface)', color: 'var(--c-600)' } : { color: '#94a3b8' }}
              >
                <SunIcon className="w-3.5 h-3.5" /> روشن
              </button>
              <button
                onClick={() => { if (!isDark) toggleMode(); }}
                className={`min-h-11 flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${isDark ? 'shadow-sm' : ''}`}
                style={isDark ? { backgroundColor: 'var(--surface)', color: 'var(--c-400)' } : { color: '#94a3b8' }}
              >
                <MoonIcon className="w-3.5 h-3.5" /> تاریک
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-2 px-1">رنگ‌بندی سایت</p>
            <div className="space-y-1">
              {THEMES.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTheme(t.key); setOpen(false); }}
                  className="w-full min-h-11 flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-right"
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: SWATCH[t.key] }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.label}</span>
                  {theme === t.key && (
                    <svg className="w-3.5 h-3.5 text-gray-400 ms-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
