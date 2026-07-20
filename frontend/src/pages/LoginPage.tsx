import { useRef, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import CopyrightNotice from "../components/common/CopyrightNotice";

export default function LoginPage() {
  const { login } = useAuth();
  const { mode } = useTheme();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
  }>({});
  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: { username?: string; password?: string } = {};
    if (!username.trim()) nextErrors.username = "نام کاربری را وارد کنید";
    if (!password.trim()) nextErrors.password = "رمز عبور را وارد کنید";
    setErrors(nextErrors);
    if (nextErrors.username) {
      usernameRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const loggedInUser = await login(username.trim(), password);
      navigate(loggedInUser?.role === "admin" ? "/admin" : "/surveys", {
        replace: true,
      });
    } catch (err: any) {
      // Field validation is inline; the toast is reserved for server-level
      // failures (wrong credentials, unavailable service, ...).
      toast.error(
        err?.response?.data?.non_field_errors?.[0] ||
          err?.response?.data?.detail ||
          "خطا در ورود به سیستم",
      );
    } finally {
      setLoading(false);
    }
  };

  const pageBackground =
    mode === "dark"
      ? "linear-gradient(135deg, #090b11 0%, var(--c-bg) 58%, rgba(255,255,255,0.03) 100%)"
      : "linear-gradient(135deg, #f8fafc 0%, var(--c-50) 100%)";

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-3 sm:p-4"
      style={{ background: pageBackground }}
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div
            className="px-5 sm:px-8 py-6 sm:py-8 text-center"
            style={{ backgroundColor: "var(--c-600)" }}
          >
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">InsightFlow</h1>
            <p className="text-white/70 text-sm mt-1">برای ادامه وارد شوید</p>
          </div>
          <div className="px-5 sm:px-8 py-6 sm:py-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="label">
                  نام کاربری
                </label>
                <div className="relative">
                  <input
                    id="username"
                    ref={usernameRef}
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errors.username)
                        setErrors((er) => ({ ...er, username: undefined }));
                    }}
                    className={`input-field pr-10 ${errors.username ? "border-red-400" : ""}`}
                    placeholder="نام کاربری خود را وارد کنید"
                    autoComplete="username"
                    disabled={loading}
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={
                      errors.username ? "username-error" : undefined
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </span>
                </div>
                {errors.username && (
                  <p
                    id="username-error"
                    role="alert"
                    className="text-xs text-red-500 mt-1"
                  >
                    {errors.username}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="label">
                  رمز عبور
                </label>
                <div className="relative">
                  <input
                    id="password"
                    ref={passwordRef}
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password)
                        setErrors((er) => ({ ...er, password: undefined }));
                    }}
                    className={`input-field pr-10 pl-10 ${errors.password ? "border-red-400" : ""}`}
                    placeholder="رمز عبور خود را وارد کنید"
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "password-error" : undefined
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? "پنهان کردن رمز عبور" : "نمایش رمز عبور"}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPass ? (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p
                    id="password-error"
                    role="alert"
                    className="text-xs text-red-500 mt-1"
                  >
                    {errors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    در حال ورود...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                      />
                    </svg>
                    ورود به سیستم
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-5 sm:mt-6 px-2">
          سامانه نظرسنجی سازمانی
        </p>
        <CopyrightNotice className="mt-2 px-2" />
      </motion.div>
    </div>
  );
}
