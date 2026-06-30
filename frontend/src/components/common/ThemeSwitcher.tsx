import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme, THEMES, Theme } from '../../contexts/ThemeContext';

const SWATCH: Record<Theme, string> = {
  purple: '#9333ea',
  blue:   '#2563eb',
  green:  '#059669',
  red:    '#e11d48',
};

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="تغییر رنگ‌بندی"
        className="w-8 h-8 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-transform hover:scale-110"
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
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ transformOrigin: 'top left' }}
            className="absolute left-0 top-10 bg-white rounded-xl shadow-xl border border-gray-100 p-3 z-50 min-w-[140px]"
          >
            <p className="text-xs text-gray-400 mb-2 px-1">رنگ‌بندی سایت</p>
            <div className="space-y-1">
              {THEMES.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTheme(t.key); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-right"
                >
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: SWATCH[t.key] }}
                  />
                  <span className="text-sm text-gray-700">{t.label}</span>
                  {theme === t.key && (
                    <svg className="w-3.5 h-3.5 text-gray-400 mr-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
