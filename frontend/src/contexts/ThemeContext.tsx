import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'purple' | 'blue' | 'green' | 'red';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'purple', setTheme: () => {} });

export function useTheme() { return useContext(ThemeContext); }

// Each theme maps to Tailwind color names used across the app
export const THEMES: { key: Theme; label: string; bg: string; ring: string }[] = [
  { key: 'purple', label: 'بنفش',  bg: 'bg-purple-600', ring: 'ring-purple-400' },
  { key: 'blue',   label: 'آبی',   bg: 'bg-blue-600',   ring: 'ring-blue-400'   },
  { key: 'green',  label: 'سبز',   bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
  { key: 'red',    label: 'قرمز',  bg: 'bg-red-600',    ring: 'ring-red-400'    },
];

// CSS vars injected into :root per theme
const THEME_VARS: Record<Theme, Record<string, string>> = {
  purple: {
    '--c-50':  '#faf5ff',
    '--c-100': '#f3e8ff',
    '--c-200': '#e9d5ff',
    '--c-300': '#d8b4fe',
    '--c-400': '#c084fc',
    '--c-500': '#a855f7',
    '--c-600': '#9333ea',
    '--c-700': '#7e22ce',
    '--c-800': '#6b21a8',
    '--c-900': '#581c87',
    '--c-bg':  '#F8F7FF',
    '--c-scrollbar': '#c4b5fd',
    '--c-scrollbar-hover': '#a78bfa',
  },
  blue: {
    '--c-50':  '#eff6ff',
    '--c-100': '#dbeafe',
    '--c-200': '#bfdbfe',
    '--c-300': '#93c5fd',
    '--c-400': '#60a5fa',
    '--c-500': '#3b82f6',
    '--c-600': '#2563eb',
    '--c-700': '#1d4ed8',
    '--c-800': '#1e40af',
    '--c-900': '#1e3a8a',
    '--c-bg':  '#F0F7FF',
    '--c-scrollbar': '#93c5fd',
    '--c-scrollbar-hover': '#60a5fa',
  },
  green: {
    '--c-50':  '#ecfdf5',
    '--c-100': '#d1fae5',
    '--c-200': '#a7f3d0',
    '--c-300': '#6ee7b7',
    '--c-400': '#34d399',
    '--c-500': '#10b981',
    '--c-600': '#059669',
    '--c-700': '#047857',
    '--c-800': '#065f46',
    '--c-900': '#064e3b',
    '--c-bg':  '#F0FDF8',
    '--c-scrollbar': '#6ee7b7',
    '--c-scrollbar-hover': '#34d399',
  },
  red: {
    '--c-50':  '#fff1f2',
    '--c-100': '#ffe4e6',
    '--c-200': '#fecdd3',
    '--c-300': '#fda4af',
    '--c-400': '#fb7185',
    '--c-500': '#f43f5e',
    '--c-600': '#e11d48',
    '--c-700': '#be123c',
    '--c-800': '#9f1239',
    '--c-900': '#881337',
    '--c-bg':  '#FFF5F6',
    '--c-scrollbar': '#fda4af',
    '--c-scrollbar-hover': '#fb7185',
  },
};

function applyTheme(theme: Theme) {
  const vars = THEME_VARS[theme];
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  // Apply background
  document.body.style.backgroundColor = vars['--c-bg'];
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('app-theme') as Theme) || 'purple';
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('app-theme', t);
    applyTheme(t);
  };

  useEffect(() => { applyTheme(theme); }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
