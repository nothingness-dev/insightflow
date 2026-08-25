import { Component, ErrorInfo, ReactNode } from 'react';
import { authTokenStore } from '../../api/client';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort render guard. Without it any thrown render error - including a
 * corrupted session restore or a stale lazily-loaded chunk after a deploy -
 * would leave a permanent blank page with no way to recover.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearSession = () => {
    authTokenStore.clear();
    window.location.href = '/login';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
            <svg className="h-7 w-7 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            خطای غیرمنتظره‌ای رخ داد
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-6 mb-6">
            مشکلی در نمایش این بخش پیش آمد. می‌توانید دوباره تلاش کنید؛ اگر مشکل
            باقی ماند، صفحه را بازنشانی کنید یا داده‌های نشست را پاک کنید.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              تلاش دوباره
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              بازنشانی صفحه
            </button>
            <button
              type="button"
              onClick={this.handleClearSession}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              پاک‌سازی داده‌های نشست
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
