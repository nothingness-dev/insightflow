import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import ThemeSwitcher from "../components/common/ThemeSwitcher";
import ChangePasswordModal from "../components/common/ChangePasswordModal";
import PageTransition from "../components/common/PageTransition";
import CopyrightNotice from "../components/common/CopyrightNotice";
import VersionBadge from "../components/common/VersionBadge";
import { D, E, T, backdrop, popover, useMotionDisabled } from "../motion";
import toast from "react-hot-toast";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const reduced = useMotionDisabled();

  const handleLogout = async () => {
    await logout();
    toast.success("خروج موفق");
    navigate("/login");
  };

  return (
    <div
      className="min-h-[100dvh]"
      style={{ backgroundColor: "var(--c-bg)" }}
      dir="rtl"
    >
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 shadow-sm sticky top-0 z-30">
        <div className="app-container max-w-5xl py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 theme-bg rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <NavLink to="/surveys" className="compact-link text-sm font-bold text-slate-800 dark:text-slate-200">
              InsightFlow
            </NavLink>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <VersionBadge />
            <ThemeSwitcher />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="باز کردن منوی حساب کاربری"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="min-h-11 flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-7 h-7 theme-bg-100 rounded-full flex items-center justify-center theme-text-700 text-sm font-bold">
                  {user?.full_name?.[0] || "ک"}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:block">
                  {user?.full_name}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-500 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m19.5 8.25-7.5 7.5-7.5-7.5"
                  />
                </svg>
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <>
                    <motion.div
                      variants={backdrop}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={reduced ? T.instant : { duration: D.fast / 1000 }}
                      className="fixed inset-0 z-30"
                      onClick={() => setMenuOpen(false)}
                    />
                    <motion.div
                      variants={popover}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      transition={reduced ? T.instant : { duration: D.fast / 1000, ease: E.standard }}
                      style={{ transformOrigin: "top left" }}
                      className="absolute end-0 mt-2 w-52 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1.5 z-40"
                    >
                      <div className="px-3 py-2 border-b border-gray-50 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {user?.full_name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {user?.username}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setPwOpen(true);
                        }}
                        className="w-full min-h-11 text-right flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4 text-gray-400 dark:text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
                          />
                        </svg>
                        تغییر رمز عبور
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          handleLogout();
                        }}
                        className="w-full min-h-11 text-right flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        خروج
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>
      <main className="responsive-page app-container max-w-5xl py-5 sm:py-8">
        <PageTransition>{children}</PageTransition>
        <CopyrightNotice className="mt-8 border-t border-gray-100 pt-5" />
      </main>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      <ChangePasswordModal
        open={!!user?.must_change_password}
        onClose={() => {}}
        forced
      />
    </div>
  );
}
