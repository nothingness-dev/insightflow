import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('خروج موفق');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <NavLink to="/surveys" className="text-sm font-bold text-slate-800">
              سامانه نظرسنجی
            </NavLink>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-sm font-bold">
                {user?.full_name?.[0] || 'ک'}
              </div>
              <span className="text-sm text-gray-700">{user?.full_name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              خروج
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
