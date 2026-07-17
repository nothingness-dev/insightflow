import { ReactNode, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import ThemeSwitcher from "../components/common/ThemeSwitcher";
import ChangePasswordModal from "../components/common/ChangePasswordModal";
import PageTransition from "../components/common/PageTransition";
import CopyrightNotice from "../components/common/CopyrightNotice";
import toast from "react-hot-toast";

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const ChartIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);
const ProgressIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3v18h18M7 16l4-5 3 3 5-7"
    />
  </svg>
);
const SurveyIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);
const UsersIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);
const LogoutIcon = () => (
  <svg
    className="w-5 h-5"
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
);
const MenuIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);
const CloseIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);
const ActivityIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.8}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 12h4l3 8 4-16 3 8h4"
    />
  </svg>
);

const navItems: NavItem[] = [
  { path: "/admin", label: "داشبورد", icon: <ChartIcon /> },
  { path: "/admin/surveys", label: "نظرسنجی‌ها", icon: <SurveyIcon /> },
  { path: "/admin/survey-progress", label: "پیشرفت", icon: <ProgressIcon /> },
  { path: "/admin/users", label: "کارکنان", icon: <UsersIcon /> },
  { path: "/admin/activity", label: "مرکز فعالیت‌ها", icon: <ActivityIcon /> },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success("خروج موفق");
    navigate("/login");
  };

  const Sidebar = ({ mobile = false }) => (
    <aside
      className={`flex flex-col h-full bg-white border-l border-gray-100 shadow-sm ${mobile ? "w-full" : "w-64"}`}
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center theme-bg">
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
          <div>
            <p className="text-sm font-bold text-slate-800">InsightFlow</p>
            <p className="text-xs text-gray-400">پنل مدیریت</p>
          </div>
        </div>
        {mobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <CloseIcon />
          </button>
        )}
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/admin"}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? "active" : ""}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 theme-bg-100 rounded-full flex items-center justify-center theme-text-700 text-sm font-bold">
            {user?.full_name?.[0] || "م"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {user?.full_name}
            </p>
            <p className="text-xs text-gray-400">مدیر سیستم</p>
          </div>
        </div>
        <button
          onClick={() => {
            setSidebarOpen(false);
            setPwOpen(true);
          }}
          className="sidebar-item w-full text-gray-600 hover:bg-gray-50 hover:text-gray-800"
        >
          <svg
            className="w-5 h-5"
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
          <span>تغییر رمز عبور</span>
        </button>
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <LogoutIcon />
          <span>خروج</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div
      className="flex h-[100dvh] overflow-hidden"
      style={{ backgroundColor: "var(--c-bg)" }}
      dir="rtl"
    >
      <div className="hidden lg:flex">
        <div className="w-64 h-full">
          <Sidebar />
        </div>
      </div>
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-0 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 h-full w-[min(20rem,calc(100vw-2rem))] max-w-full"
            >
              <Sidebar mobile />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              aria-label="باز کردن منوی مدیریت"
              className="lg:hidden touch-target text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon />
            </button>
            <p className="text-sm text-gray-400 hidden sm:block">
              سامانه نظرسنجی سازمانی
            </p>
          </div>
          <ThemeSwitcher />
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-7">
          <PageTransition>{children}</PageTransition>
          <CopyrightNotice className="mt-8 border-t border-gray-100 pt-5" />
        </main>
      </div>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
      <ChangePasswordModal
        open={!!user?.must_change_password}
        onClose={() => {}}
        forced
      />
    </div>
  );
}
