import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ChangePasswordModal from "../components/common/ChangePasswordModal";
import CopyrightNotice from "../components/common/CopyrightNotice";
import PageTransition from "../components/common/PageTransition";
import ShellOverflowMenu from "../components/common/ShellOverflowMenu";
import toast from "react-hot-toast";

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);

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
      <header className="shell-header sticky top-0 z-30 border-b border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="app-container flex max-w-5xl items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="theme-bg flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0-2-2h2a2 2 0 0 1 2 2"
                />
              </svg>
            </div>
            <NavLink
              to="/surveys"
              className="compact-link min-w-0 truncate text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              InsightFlow
            </NavLink>
          </div>

          <ShellOverflowMenu
            userName={user?.full_name}
            username={user?.username}
            roleLabel="کارمند"
            onChangePassword={() => setPwOpen(true)}
            onLogout={handleLogout}
          />
        </div>
      </header>

      <main className="shell-main responsive-page app-container max-w-5xl py-5 pb-[max(1.25rem,var(--safe-bottom))] sm:py-8 sm:pb-[max(2rem,var(--safe-bottom))]">
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
