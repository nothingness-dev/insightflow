import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'purple' | 'blue' | 'green' | 'red';
export type Mode = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'purple',
  setTheme: () => {},
  mode: 'light',
  setMode: () => {},
  toggleMode: () => {},
});

export function useTheme() { return useContext(ThemeContext); }

const MODE_KEY = 'app-theme-mode';
const THEME_KEY = 'app-theme';

export const THEMES: { key: Theme; label: string; bg: string; ring: string }[] = [
  { key: 'purple', label: 'بنفش',  bg: 'bg-purple-600', ring: 'ring-purple-400' },
  { key: 'blue',   label: 'آبی',   bg: 'bg-blue-600',   ring: 'ring-blue-400'   },
  { key: 'green',  label: 'سبز',   bg: 'bg-emerald-600', ring: 'ring-emerald-400' },
  { key: 'red',    label: 'قرمز',  bg: 'bg-red-600',    ring: 'ring-red-400'    },
];

// Light-mode palettes — unchanged from the original single-mode theme.
const LIGHT_VARS: Record<Theme, Record<string, string>> = {
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

// Dark-mode palettes. The 50/100/200 tints become translucent overlays over
// the dark surface (instead of near-white fills), --c-600 stays the vivid
// "identity" shade used for solid button backgrounds, and --c-700 — which
// components use as *text/hover* color on top of light backgrounds in light
// mode — is remapped to a lighter tone so the same text stays readable on
// dark surfaces instead of going near-invisible.
const DARK_VARS: Record<Theme, Record<string, string>> = {
  purple: {
    '--c-50':  'rgba(168,85,247,0.12)',
    '--c-100': 'rgba(168,85,247,0.20)',
    '--c-200': 'rgba(168,85,247,0.38)',
    '--c-300': '#d8b4fe',
    '--c-400': '#c084fc',
    '--c-500': '#a855f7',
    '--c-600': '#9333ea',
    '--c-700': '#c084fc',
    '--c-800': '#d8b4fe',
    '--c-900': '#e9d5ff',
    '--c-bg':  '#121016',
    '--c-scrollbar': 'rgba(168,85,247,0.45)',
    '--c-scrollbar-hover': 'rgba(168,85,247,0.65)',
  },
  blue: {
    '--c-50':  'rgba(59,130,246,0.12)',
    '--c-100': 'rgba(59,130,246,0.20)',
    '--c-200': 'rgba(59,130,246,0.38)',
    '--c-300': '#93c5fd',
    '--c-400': '#60a5fa',
    '--c-500': '#3b82f6',
    '--c-600': '#2563eb',
    '--c-700': '#60a5fa',
    '--c-800': '#93c5fd',
    '--c-900': '#bfdbfe',
    '--c-bg':  '#0e1420',
    '--c-scrollbar': 'rgba(59,130,246,0.45)',
    '--c-scrollbar-hover': 'rgba(59,130,246,0.65)',
  },
  green: {
    '--c-50':  'rgba(16,185,129,0.12)',
    '--c-100': 'rgba(16,185,129,0.20)',
    '--c-200': 'rgba(16,185,129,0.38)',
    '--c-300': '#6ee7b7',
    '--c-400': '#34d399',
    '--c-500': '#10b981',
    '--c-600': '#059669',
    '--c-700': '#34d399',
    '--c-800': '#6ee7b7',
    '--c-900': '#a7f3d0',
    '--c-bg':  '#0e1712',
    '--c-scrollbar': 'rgba(16,185,129,0.45)',
    '--c-scrollbar-hover': 'rgba(16,185,129,0.65)',
  },
  red: {
    '--c-50':  'rgba(244,63,94,0.12)',
    '--c-100': 'rgba(244,63,94,0.20)',
    '--c-200': 'rgba(244,63,94,0.38)',
    '--c-300': '#fda4af',
    '--c-400': '#fb7185',
    '--c-500': '#f43f5e',
    '--c-600': '#e11d48',
    '--c-700': '#fb7185',
    '--c-800': '#fda4af',
    '--c-900': '#fecdd3',
    '--c-bg':  '#180f12',
    '--c-scrollbar': 'rgba(244,63,94,0.45)',
    '--c-scrollbar-hover': 'rgba(244,63,94,0.65)',
  },
};

function applyVars(theme: Theme, mode: Mode) {
  const vars = (mode === 'dark' ? DARK_VARS : LIGHT_VARS)[theme];
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.body.style.backgroundColor = vars['--c-bg'];
}

function applyModeClass(mode: Mode) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
}

function getSystemMode(): Mode {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(THEME_KEY) as Theme) || 'purple';
  });
  const [mode, setModeState] = useState<Mode>(() => {
    const saved = localStorage.getItem(MODE_KEY) as Mode | null;
    return saved === 'light' || saved === 'dark' ? saved : getSystemMode();
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
  };

  const setMode = (m: Mode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  };

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    applyModeClass(mode);
    applyVars(theme, mode);
  }, [theme, mode]);

  // Follow the OS setting live only if the person hasn't explicitly chosen a
  // mode yet in this browser.
  useEffect(() => {
    if (localStorage.getItem(MODE_KEY)) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setModeState(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
