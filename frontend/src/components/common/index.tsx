import { ReactNode, RefObject, forwardRef, useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  D, E, T, fadeUp, fadeScale, backdrop, popover,
  useMotionDisabled, useFocusTrap, useKeyboardNav,
} from '../../motion';


interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: 'current-password' | 'new-password' | 'off';
  error?: boolean;
  ariaDescribedBy?: string;
}

export function PasswordInput({ id, value, onChange, placeholder, autoFocus, autoComplete = 'new-password', error, ariaDescribedBy }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className={`input-field w-full pe-12 ${error ? 'border-red-400' : ''}`}
        aria-invalid={error || undefined}
        aria-describedby={ariaDescribedBy}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
        className="icon-button absolute end-0 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
      >
        {show ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.774 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L9.88 9.88" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        )}
      </button>
    </div>
  );
}


interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  bodyClassName?: string;
  footerClassName?: string;
  ariaLabel?: string;
  describedBy?: string;
  dismissible?: boolean;
  busy?: boolean;
  showCloseButton?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  testId?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  bodyClassName = '',
  footerClassName = '',
  ariaLabel = 'پنجره گفتگو',
  describedBy,
  dismissible = true,
  busy = false,
  showCloseButton = true,
  initialFocusRef,
  testId,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const reduced = useMotionDisabled();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    dismissibleRef.current = dismissible;
  }, [dismissible]);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedRef.current?.isConnected) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [open]);

  useFocusTrap(dialogRef, open, initialFocusRef);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4"
          data-testid={testId ? `${testId}-layer` : 'modal-layer'}
        >
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={reduced ? T.instant : { duration: D.fast / 1000 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm dark:bg-black/60"
            onClick={dismissible ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : ariaLabel}
            aria-describedby={describedBy}
            aria-busy={busy || undefined}
            tabIndex={-1}
            data-testid={testId || 'modal-dialog'}
            variants={fadeScale}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={reduced ? T.instant : { duration: D.normal / 1000, ease: E.standard }}
            className="relative flex h-[100dvh] w-full flex-col overflow-hidden border border-gray-100 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
            style={
              size === 'sm' ? { maxWidth: '24rem' } :
              size === 'md' ? { maxWidth: '32rem' } :
              size === 'lg' ? { maxWidth: '42rem' } :
              { maxWidth: '56rem' }
            }
          >
            {(title || showCloseButton) && (
              <div
                className="flex flex-none items-center justify-between gap-3 border-b border-gray-100 px-4 pb-3 pt-[max(0.75rem,var(--safe-top))] dark:border-gray-700 sm:px-6 sm:py-4"
                data-testid="modal-header"
              >
                {title ? (
                  <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
                ) : (
                  <span aria-hidden="true" />
                )}
                {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={!dismissible}
                  aria-label="بستن پنجره"
                  className="icon-button -m-1 shrink-0 rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                )}
              </div>
            )}
            <div
              className={`modal-scroll-region min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}
              data-testid="modal-body"
            >
              {children}
            </div>
            {footer && (
              <div
                className={`flex-none border-t border-gray-100 bg-white px-4 pb-[max(0.75rem,var(--safe-bottom))] pt-3 dark:border-gray-700 dark:bg-gray-800 sm:px-6 sm:pb-4 ${footerClassName}`}
                data-testid="modal-footer"
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface ModalErrorSummaryProps {
  errors: string[];
  title?: string;
  className?: string;
}

export const ModalErrorSummary = forwardRef<HTMLDivElement, ModalErrorSummaryProps>(function ModalErrorSummary(
  { errors, title = 'لطفاً خطاهای زیر را اصلاح کنید', className = '' },
  ref,
) {
  if (errors.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      data-testid="modal-error-summary"
      className={`rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 ${className}`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs leading-relaxed">
        {errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
      </ul>
    </div>
  );
});


interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'تایید', confirmVariant = 'danger', loading }: ConfirmModalProps) {
  const descriptionId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      describedBy={descriptionId}
      dismissible={!loading}
      busy={loading}
      bodyClassName="p-5 sm:p-6"
      footer={(
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`min-h-11 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              confirmVariant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-[color:var(--c-600)] hover:bg-[color:var(--c-700)] text-white'
            }`}
          >
            {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {confirmLabel}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>انصراف</button>
        </div>
      )}
    >
      <div>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmVariant === 'danger' ? 'bg-red-50' : ''}`}
          style={confirmVariant === 'danger' ? undefined : { backgroundColor: 'var(--c-50)' }}
        >
          {confirmVariant === 'danger' ? (
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-[color:var(--c-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <p id={descriptionId} className="text-sm text-gray-500 text-center leading-relaxed dark:text-gray-300">{message}</p>
      </div>
    </Modal>
  );
}


export function StatusBadge({ status, expired }: { status: string; expired?: boolean }) {
  if (expired && status === 'published') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">مهلت به پایان رسیده</span>;
  }
  const map: Record<string, { label: string; className: string }> = {
    draft:     { label: 'پیش‌نویس',   className: 'badge-draft' },
    published: { label: 'منتشر شده', className: 'badge-published' },
    closed:    { label: 'بسته شده',  className: 'badge-closed' },
  };
  const cfg = map[status] || { label: status, className: 'badge-draft' };
  return <span className={cfg.className}>{cfg.label}</span>;
}


export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

export function CardGridSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2.5 w-full rounded-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function SurveyDetailSkeleton() {
  return (
    <div className="responsive-page">
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>
      <PersonGridSkeleton items={6} />
    </div>
  );
}

export function UserTableSkeleton() {
  return (
    <div className="responsive-page">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm rounded-lg mb-4" />
      <TableSkeleton rows={6} />
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm card p-6 sm:p-8 space-y-5">
        <div className="flex flex-col items-center gap-3 mb-2">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden" aria-busy="true" aria-label="در حال بارگذاری فهرست">
      <div className="divide-y divide-gray-100 sm:hidden">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-50 pt-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden sm:block">
        <div className="grid grid-cols-12 gap-4 border-b border-gray-100 bg-gray-50 p-4">
          <Skeleton className="col-span-5 h-4" />
          <Skeleton className="col-span-2 h-4" />
          <Skeleton className="col-span-2 hidden h-4 lg:block" />
          <Skeleton className="col-span-3 h-4" />
        </div>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-12 gap-4 border-b border-gray-50 p-4 items-center last:border-b-0">
            <Skeleton className="h-5 col-span-5" />
            <Skeleton className="h-5 col-span-2 hidden md:block" />
            <Skeleton className="h-5 col-span-2 hidden lg:block" />
            <Skeleton className="h-8 col-span-7 md:col-span-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PersonGridSkeleton({ items = 8 }: { items?: number }) {
  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="card overflow-hidden">
          <Skeleton className="w-full aspect-square rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}


export function AnonymousSurveySkeleton() {
  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: 'var(--c-bg)' }} dir="rtl">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="w-9 h-9 rounded-lg" />
      </header>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
        <PersonGridSkeleton items={4} />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  const reduced = useMotionDisabled();

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={reduced ? T.instant : { duration: D.normal / 1000, ease: E.standard }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4 text-gray-300 dark:text-gray-500">
        {icon || (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 dark:text-gray-500 mb-5 max-w-xs">{description}</p>}
      {action}
    </motion.div>
  );
}


interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  const reduced = useMotionDisabled();

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={reduced ? T.instant : { duration: D.normal / 1000, ease: E.standard }}
      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6"
    >
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action && <div className="w-full sm:w-auto flex-shrink-0">{action}</div>}
    </motion.div>
  );
}


export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }[size];
  return <div className={`${s} border-2 border-[color:var(--c-600)] border-t-transparent rounded-full animate-spin`} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Spinner size="lg" />
    </div>
  );
}


export function DashboardSkeleton() {
  return (
    <div className="responsive-page">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full sm:w-48 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


export function FormSkeleton() {
  return (
    <div className="responsive-page max-w-3xl" aria-busy="true" aria-label="در حال بارگذاری فرم نظرسنجی">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full max-w-72" />
      </div>
      <div className="space-y-4">
        <div className="card p-4 sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-gray-100 pb-4">
            <Skeleton className="h-8 w-8 flex-shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
        </div>
        <div className="card p-4 sm:p-6">
          <div className="mb-5 flex items-start gap-3 border-b border-gray-100 pb-4">
            <Skeleton className="h-8 w-8 flex-shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-full max-w-sm" /></div>
          </div>
          <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="border border-gray-100 rounded-xl p-4 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <div className="grid grid-cols-2 gap-2"><Skeleton className="h-16 rounded-lg" /><Skeleton className="h-16 rounded-lg" /></div>
            </div>
          ))}
          </div>
        </div>
        <div className="card px-3 py-2.5 sm:px-4">
          <Skeleton className="mx-auto mb-2 h-3 w-32 sm:hidden" />
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 sm:flex">
            <Skeleton className="h-11 w-full rounded-lg sm:w-32" />
            <Skeleton className="h-11 w-full rounded-lg sm:w-24" />
            <Skeleton className="h-11 w-full rounded-lg sm:mr-auto sm:w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}


export function ProgressListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="responsive-page" aria-busy="true" aria-label="در حال بارگذاری پیشرفت نظرسنجی‌ها">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="mb-6 grid grid-cols-1 items-start gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5">
          <div className="mb-4 space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-3/4" /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="card flex items-center gap-3 p-4 sm:p-5"><Skeleton className="h-12 w-12 flex-shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-24" /></div></div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 sm:p-5">
          <div className="mb-4 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-3/4" /></div>
          <div className="card flex items-center gap-3 p-4 sm:p-5"><Skeleton className="h-12 w-12 flex-shrink-0 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-6 w-16" /><Skeleton className="h-3 w-28" /></div></div>
        </div>
      </div>
      <div className="card mb-6 p-4 sm:p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="space-y-2"><div className="flex justify-between gap-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-20" /></div><Skeleton className="h-2.5 w-full rounded-full" /></div>)}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {Array.from({ length: items }).map((_, index) => (
          <div key={index} className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


export function ResultsSkeleton() {
  return (
    <div className="responsive-page max-w-4xl" aria-busy="true" aria-label="در حال بارگذاری نتایج نظرسنجی">
      <Skeleton className="h-4 w-32 mb-5" />
      <div className="card mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
          <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-4 w-full max-w-64" /></div>
          <div className="grid grid-cols-2 gap-2 min-[420px]:flex"><Skeleton className="col-span-2 h-11 rounded-lg min-[420px]:col-span-1 min-[420px]:w-28" /><Skeleton className="h-11 rounded-lg min-[420px]:w-16" /><Skeleton className="h-11 rounded-lg min-[420px]:w-16" /></div>
        </div>
      </div>
      <div className="flex gap-1 mb-5 border-b border-gray-100">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-11 flex-1 rounded-t-lg sm:flex-none sm:w-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
        ))}
      </div>
      <div className="card p-5 space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}


interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  disabled?: boolean;
}

export function Select({ value, onChange, options, placeholder = 'انتخاب کنید', className = '', searchable, disabled }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = useMotionDisabled();

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const selected = options.find(o => o.value === value);
  const shouldSearch = searchable ?? options.length > 6;
  const filtered = shouldSearch && query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`select-trigger w-full ${open ? 'select-trigger-open' : ''}`}
      >
        <span className={`truncate ${!selected ? 'text-gray-400' : ''}`}>{selected ? selected.label : placeholder}</span>
        <svg className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={popover}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={reduced ? T.instant : { duration: D.fast / 1000, ease: E.standard }}
            className="select-panel absolute z-50 mt-1.5 w-full min-w-[10rem]"
          >
            {shouldSearch && (
              <div className="p-2 select-panel-border">
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="جستجو..."
                  className="select-search w-full"
                />
              </div>
            )}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">موردی یافت نشد</p>
              ) : filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }}
                  className={`select-option ${o.value === value ? 'select-option-active' : ''}`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
}

export function SearchInput({ value, onChange, placeholder = 'جستجو...', id, ariaLabel }: SearchProps) {
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input-field pr-9 w-full"
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>
    </div>
  );
}


export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function ActionMenu({
  items,
  label = 'عملیات بیشتر',
  placement = 'auto',
}: {
  items: ActionMenuItem[];
  label?: string;
  placement?: 'auto' | 'top' | 'bottom';
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; opensUp: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);
  const reduced = useMotionDisabled();

  const closeMenu = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const { activeIndex, setActiveIndex } = useKeyboardNav(open, closeMenu, menuRef, itemsRef);

  const updateMenuPosition = useCallback(() => {
    const button = triggerRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 176;
    const menuHeight = items.length * 44 + Math.max(0, items.length - 1) * 2 + 12;
    const viewportPadding = 8;
    const gap = 6;
    const spaceAbove = rect.top - viewportPadding;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const opensUp = placement === 'top'
      ? spaceAbove >= menuHeight || spaceAbove >= spaceBelow
      : placement === 'bottom'
        ? !(spaceBelow >= menuHeight || spaceBelow >= spaceAbove)
        : spaceBelow < menuHeight && spaceAbove > spaceBelow;
    const preferredTop = opensUp
      ? rect.top - menuHeight - gap
      : rect.bottom + gap;

    setMenuPosition({
      top: Math.min(
        Math.max(viewportPadding, preferredTop),
        Math.max(viewportPadding, window.innerHeight - menuHeight - viewportPadding),
      ),
      left: Math.min(
        Math.max(viewportPadding, rect.left),
        Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding),
      ),
      opensUp,
    });
  }, [items.length, placement]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        rootRef.current
        && !rootRef.current.contains(target)
        && !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open, updateMenuPosition]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen(current => !current);
        }}
        className={`icon-button rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors ${open ? 'bg-gray-100' : ''}`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {createPortal(
        <AnimatePresence>
        {open && menuPosition && (
          <motion.div
            ref={menuRef}
            role="menu"
            variants={popover}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={reduced ? T.instant : { duration: D.fast / 1000, ease: E.standard }}
            className="select-panel fixed z-[100] min-w-[11rem] p-1.5 space-y-0.5"
            style={{ top: menuPosition.top, left: menuPosition.left }}
          >
            {items.map((item, i) => (
              <button
                key={`${item.label}-${i}`}
                ref={(el) => { itemsRef.current[i] = el; }}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                title={item.disabled ? item.disabledReason : undefined}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => { if (!item.disabled) { setOpen(false); item.onClick(); } }}
                className={`w-full min-h-11 text-right px-3 py-2 text-sm rounded-lg transition-colors flex items-center ${
                  item.disabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-100'
                } ${activeIndex === i ? 'bg-gray-100' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
