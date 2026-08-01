import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { THEMES, Theme, useTheme } from "../../contexts/ThemeContext";
import { D, E, T, backdrop, fadeScale, useFocusTrap, useMotionDisabled } from "../../motion";
import VersionBadge from "./VersionBadge";

const THEME_SWATCH: Record<Theme, string> = {
  purple: "#9333ea",
  blue: "#2563eb",
  green: "#059669",
  red: "#e11d48",
};

const MoreIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="5" cy="12" r="1.75" />
    <circle cx="12" cy="12" r="1.75" />
    <circle cx="19" cy="12" r="1.75" />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const KeyIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="m17 16 4-4m0 0-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
  </svg>
);

interface ShellOverflowMenuProps {
  userName?: string;
  username?: string;
  roleLabel?: string;
  settingsPath?: string;
  onChangePassword?: () => void;
  onLogout?: () => void | Promise<void>;
}

export default function ShellOverflowMenu({
  userName,
  username,
  roleLabel,
  settingsPath,
  onChangePassword,
  onLogout,
}: ShellOverflowMenuProps) {
  const { theme, setTheme, mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduced = useMotionDisabled();
  const hasAccountActions = Boolean(onChangePassword || onLogout || settingsPath);

  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        data-testid="shell-overflow-trigger"
        aria-label="باز کردن منوی حساب و نمایش"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="icon-button rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <MoreIcon />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              variants={backdrop}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={reduced ? T.instant : { duration: D.fast / 1000 }}
              className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px] dark:bg-black/60"
              onClick={close}
              aria-hidden="true"
            />
            <motion.div
              ref={panelRef}
              id={titleId}
              data-testid="shell-overflow-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="تنظیمات حساب و نمایش"
              tabIndex={-1}
              variants={fadeScale}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={reduced ? T.instant : { duration: D.fast / 1000, ease: E.standard }}
              className="fixed z-[70] w-[calc(100vw-1.75rem)] max-w-sm overflow-y-auto overscroll-contain rounded-2xl border border-gray-100 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
              style={{
                top: "calc(var(--safe-top) + 4rem)",
                insetInlineEnd: "max(var(--page-gutter), var(--safe-left))",
                maxHeight: "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 5rem)",
                transformOrigin: "top left",
              }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-1 pb-3 dark:border-gray-700">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {userName || "تنظیمات نمایش"}
                  </p>
                  {(username || roleLabel) && (
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                      {[username, roleLabel].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="بستن منوی حساب و نمایش"
                  className="icon-button -m-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="space-y-4 px-1 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-300">نسخه برنامه</span>
                  <VersionBadge />
                </div>

                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">حالت نمایش</legend>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-1 dark:bg-gray-900/40">
                    <button
                      type="button"
                      aria-pressed={mode === "light"}
                      onClick={() => setMode("light")}
                      className="min-h-11 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-white dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      روشن
                    </button>
                    <button
                      type="button"
                      aria-pressed={mode === "dark"}
                      onClick={() => setMode("dark")}
                      className="min-h-11 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-white dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      تاریک
                    </button>
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">رنگ‌بندی</legend>
                  <div className="grid grid-cols-4 gap-2">
                    {THEMES.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        aria-label={`رنگ‌بندی ${item.label}`}
                        aria-pressed={theme === item.key}
                        onClick={() => setTheme(item.key)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-700"
                      >
                        <span
                          className="h-5 w-5 rounded-full shadow-sm"
                          style={{ backgroundColor: THEME_SWATCH[item.key] }}
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              {hasAccountActions && (
                <div className="space-y-1 border-t border-gray-100 pt-2 dark:border-gray-700">
                  {settingsPath && (
                    <Link
                      to={settingsPath}
                      onClick={close}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <SettingsIcon />
                      تنظیمات سیستم
                    </Link>
                  )}
                  {onChangePassword && (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onChangePassword();
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-right text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      <KeyIcon />
                      تغییر رمز عبور
                    </button>
                  )}
                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        void onLogout();
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-right text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <LogoutIcon />
                      خروج
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
