import { useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal, ConfirmModal, ModalErrorSummary } from './index';
import { authApi } from '../../api/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { getErrorMessage } from '../../utils/helpers';

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);
const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.774 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L9.88 9.88" />
  </svg>
);

function PasswordField({ id, label, value, onChange, placeholder, autoFocus, autoComplete = 'new-password', errorId, invalid }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean;
  autoComplete?: 'current-password' | 'new-password'; errorId?: string; invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="input-field w-full pe-12"
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'پنهان کردن رمز' : 'نمایش رمز'}
          className="icon-button absolute end-0 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  
  forced?: boolean;
}

export default function ChangePasswordModal({ open, onClose, forced = false }: Props) {
  const { updateUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const idPrefix = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const currentId = `${idPrefix}-current`;
  const nextId = `${idPrefix}-next`;
  const confirmId = `${idPrefix}-confirm`;

  const reset = () => {
    setCurrent(''); setNext(''); setConfirmPass(''); setErrors({}); setConfirmOpen(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!current) e.current = 'رمز عبور فعلی را وارد کنید.';
    if (!next) e.next = 'رمز عبور جدید را وارد کنید.';
    if (confirmPass !== next) e.confirm = 'تکرار رمز عبور مطابقت ندارد.';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
    return Object.keys(e).length === 0;
  };


  const handleSubmit = () => {
    if (validate()) setConfirmOpen(true);
  };

  const doChange = async () => {
    setSubmitting(true);
    try {
      await authApi.changePassword({
        current_password: current,
        new_password: next,
        new_password_confirm: confirmPass,
      });
      updateUser({ must_change_password: false });
      toast.success('رمز عبور با موفقیت تغییر یافت');
      reset();
      onClose();
    } catch (err) {
      setConfirmOpen(false);
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (forced || submitting) return;
    reset();
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={forced ? 'تغییر رمز عبور الزامی' : 'تغییر رمز عبور'}
        size="sm"
        dismissible={!forced && !submitting}
        busy={submitting}
        showCloseButton={!forced}
        bodyClassName="p-4 sm:p-6"
        footer={(
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <button type="button" onClick={handleSubmit} className="btn-primary" disabled={submitting}>
              تغییر رمز عبور
            </button>
            {!forced && (
              <button type="button" onClick={handleClose} className="btn-secondary" disabled={submitting}>انصراف</button>
            )}
          </div>
        )}
      >
        <div className="space-y-4">
          <ModalErrorSummary ref={errorSummaryRef} errors={Object.values(errors).filter(Boolean)} />
          {forced && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">تغییر رمز عبور الزامی است</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  برای حفظ امنیت حساب، باید در اولین ورود رمز عبور خود را تغییر دهید.
                </p>
              </div>
            </div>
          )}

          <PasswordField id={currentId} label="رمز عبور فعلی" value={current} onChange={setCurrent}
            placeholder="رمز عبور فعلی" autoComplete="current-password" invalid={!!errors.current} errorId={`${currentId}-error`} />
          {errors.current && <p id={`${currentId}-error`} className="text-xs text-red-500 -mt-2">{errors.current}</p>}

          <PasswordField id={nextId} label="رمز عبور جدید" value={next} onChange={setNext}
            placeholder="رمز عبور جدید" invalid={!!errors.next} errorId={`${nextId}-error`} />
          {errors.next && <p id={`${nextId}-error`} className="text-xs text-red-500 -mt-2">{errors.next}</p>}

          <PasswordField id={confirmId} label="تکرار رمز عبور" value={confirmPass} onChange={setConfirmPass}
            placeholder="رمز عبور جدید را دوباره وارد کنید" invalid={!!errors.confirm} errorId={`${confirmId}-error`} />
          {errors.confirm && <p id={`${confirmId}-error`} className="text-xs text-red-500 -mt-2">{errors.confirm}</p>}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        onConfirm={doChange}
        title="تأیید تغییر رمز عبور"
        message="آیا از تغییر رمز عبور خود اطمینان دارید؟ پس از تغییر، با رمز جدید وارد خواهید شد."
        confirmLabel="بله، تغییر بده"
        confirmVariant="primary"
        loading={submitting}
      />
    </>
  );
}
