import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const homePath = user ? (user.role === 'admin' ? '/admin' : '/surveys') : '/login';
  const homeLabel = user ? (user.role === 'admin' ? 'بازگشت به داشبورد' : 'بازگشت به نظرسنجی‌ها') : 'بازگشت به ورود';

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--c-bg)' }}
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md text-center"
      >
        <div className="relative inline-flex items-center justify-center mb-6">
          <div
            className="w-28 h-28 rounded-3xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--c-50)' }}
          >
            <svg
              className="w-14 h-14"
              style={{ color: 'var(--c-400)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.276M12 17.05v.001M12 21a9 9 0 100-18 9 9 0 000 18z"
              />
            </svg>
          </div>
          <span
            className="absolute -bottom-2 px-3 py-1 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: 'var(--c-600)' }}
          >
            404
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">صفحه مورد نظر پیدا نشد</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">
          آدرسی که وارد کرده‌اید وجود ندارد یا جابه‌جا شده است. لطفاً نشانی را بررسی کنید یا به صفحه اصلی بازگردید.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-secondary w-full sm:w-auto">
            بازگشت به صفحه قبل
          </button>
          <Link to={homePath} className="btn-primary w-full sm:w-auto">
            {homeLabel}
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
