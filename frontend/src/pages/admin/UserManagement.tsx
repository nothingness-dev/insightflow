import { useState, FormEvent, useId, useRef } from 'react';
import { adminUserApi } from '../../api/endpoints';
import { BulkImportResult, User } from '../../types';
import { PageHeader, SearchInput, Select, EmptyState, TableSkeleton, ConfirmModal, Modal, ModalErrorSummary, PasswordInput, ActionMenu } from '../../components/common/index';
import { formatDate, formatNumber, getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { RoleBadge } from './components/RoleBadge';
import { USERS_PER_PAGE, useUserDirectory } from './hooks/useUserDirectory';
import { emptyUserForm, type UserFormData } from './types/userManagement';

function UserStatus({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700">
      فعال
    </span>
  ) : (
    <span className="inline-flex min-h-7 shrink-0 items-center whitespace-nowrap rounded-full border border-red-100 bg-red-50 px-2.5 text-xs font-semibold text-red-700">
      غیرفعال
    </span>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const {
    users,
    setUsers,
    loading,
    loadError,
    search,
    roleFilter,
    page,
    setPage,
    totalUsers,
    load,
    refreshFirstPage,
    handleSearchChange,
    handleRoleChange,
  } = useUserDirectory();
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyUserForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');
  const [resetErr, setResetErr] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);


  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const userFormId = useId();
  const userFieldPrefix = useId();


  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const hasActiveFilters = Boolean(search.trim() || roleFilter);

  const clearFilters = () => {
    handleSearchChange('');
    handleRoleChange('');
  };

  const openCreate = () => { setEditUser(null); setForm(emptyUserForm); setErrors({}); setModalOpen(true); };
  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ username: u.username, full_name: u.full_name, role: u.role, password: '', password_confirm: '', is_active: u.is_active });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = 'نام کاربری الزامی است';
    if (!form.full_name.trim()) e.full_name = 'نام الزامی است';
    if (!editUser && !form.password) e.password = 'رمز عبور الزامی است';
    if (!editUser && form.password !== form.password_confirm) e.password_confirm = 'رمزها مطابقت ندارند';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
    }
    return Object.keys(e).length === 0;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (editUser) {
        const r = await adminUserApi.update(editUser.id, { full_name: form.full_name, role: form.role as 'admin' | 'employee', is_active: form.is_active });
        setUsers(u => u.map(x => x.id === editUser.id ? r.data : x));
        toast.success('اطلاعات کاربر ذخیره شد');
      } else {
        const r = await adminUserApi.create({ username: form.username, full_name: form.full_name, role: form.role as 'admin' | 'employee', password: form.password, password_confirm: form.password_confirm, is_active: form.is_active });
        toast.success('کاربر ایجاد شد');
        refreshFirstPage();
      }
      setModalOpen(false);
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (user: User) => {
    try {
      if (user.is_active) {
        await adminUserApi.deactivate(user.id);
        setUsers(u => u.map(x => x.id === user.id ? { ...x, is_active: false } : x));
        toast.success('حساب غیرفعال شد');
      } else {
        await adminUserApi.activate(user.id);
        setUsers(u => u.map(x => x.id === user.id ? { ...x, is_active: true } : x));
        toast.success('حساب فعال شد');
      }
      setDeactivateId(null);
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  const closeResetModal = () => {
    setResetId(null); setNewPass(''); setNewPassConfirm(''); setResetErr(''); setResetConfirmOpen(false);
  };

  const requestReset = () => {
    if (!newPass) { setResetErr('رمز عبور را وارد کنید.'); return; }
    if (newPass !== newPassConfirm) { setResetErr('تکرار رمز عبور مطابقت ندارد.'); return; }
    setResetErr(''); setResetConfirmOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetId) return;
    setResetting(true);
    try {
      await adminUserApi.resetPassword(resetId, newPass);
      toast.success('رمز عبور تغییر یافت. کاربر در ورود بعدی باید آن را تغییر دهد.');
      closeResetModal();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setResetting(false); }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    setDeletingUser(true);
    try {
      await adminUserApi.delete(deleteUserId);
      toast.success('کاربر حذف شد');
      setDeleteUserId(null);
      if (users.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        void load();
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeletingUser(false); }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const r = await adminUserApi.bulkImport(importFile);
      setImportResult(r.data);
      if (r.data.created_count > 0) {
        toast.success(`${formatNumber(r.data.created_count)} کاربر ایجاد شد`);
        refreshFirstPage();
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setImporting(false); }
  };

  const set = (field: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors(er => ({ ...er, [field]: '' }));
  };

  const getUserActions = (user: User) => [
    { label: 'ویرایش', onClick: () => openEdit(user) },
    { label: 'تغییر رمز عبور', onClick: () => { setResetId(user.id); setNewPass(''); } },
    {
      label: user.is_active ? 'غیرفعال‌سازی' : 'فعال‌سازی',
      onClick: () => handleToggleActive(user),
      disabled: user.is_active && user.id === currentUser?.id,
      disabledReason: 'نمی‌توانید حساب خود را غیرفعال کنید',
    },
    {
      label: 'حذف',
      danger: true,
      onClick: () => setDeleteUserId(user.id),
      disabled: user.id === currentUser?.id,
      disabledReason: 'نمی‌توانید حساب خود را حذف کنید',
    },
  ];

  return (
    <div className="responsive-page">
      <PageHeader
        title="مدیریت کارکنان"
        subtitle="ایجاد و مدیریت حساب‌های کاربری سازمان"
        action={
          <div className="flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center gap-2">
            <button
              onClick={() => { setImportModalOpen(true); setImportResult(null); setImportFile(null); }}
              className="btn-secondary w-full min-[420px]:w-auto flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              آپلود فایل
            </button>
            <button onClick={openCreate} className="btn-primary w-full min-[420px]:w-auto flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              کاربر جدید
            </button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="flex-1"><SearchInput value={search} onChange={handleSearchChange} placeholder="جستجو بر اساس نام یا نام کاربری..." /></div>
        <Select
          value={roleFilter}
          onChange={handleRoleChange}
          className="w-full sm:w-36"
          placeholder="همه نقش‌ها"
          options={[
            { value: '', label: 'همه نقش‌ها' },
            { value: 'admin', label: 'مدیر' },
            { value: 'employee', label: 'کارمند' },
          ]}
        />
      </div>

      {hasActiveFilters && (
        <div data-testid="user-filter-summary" className="mb-5 flex flex-wrap items-center gap-2" aria-label="خلاصه فیلترهای فعال">
          <span className="text-xs font-medium text-gray-500">فیلترهای فعال:</span>
          {search.trim() && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border border-[color:var(--c-200)] bg-[color:var(--c-50)] px-3 text-xs font-medium text-[color:var(--c-700)] sm:min-h-9"
            >
              <span className="max-w-48 truncate">جستجو: «{search.trim()}»</span>
              <span aria-hidden="true">×</span>
            </button>
          )}
          {roleFilter && (
            <button
              type="button"
              onClick={() => handleRoleChange('')}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--c-200)] bg-[color:var(--c-50)] px-3 text-xs font-medium text-[color:var(--c-700)] sm:min-h-9"
            >
              نقش: {roleFilter === 'admin' ? 'مدیر' : 'کارمند'}
              <span aria-hidden="true">×</span>
            </button>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-lg px-2 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-800 sm:min-h-9"
          >
            پاک کردن فیلترها
          </button>
        </div>
      )}

      {loading ? <TableSkeleton rows={6} /> : loadError ? (
        <div className="card" data-testid="user-list-load-error" role="alert">
          <EmptyState
            title="دریافت کارکنان ناموفق بود"
            description={loadError}
            action={<button onClick={() => void load()} className="btn-primary">تلاش دوباره</button>}
          />
        </div>
      ) : users.length === 0 ? (
        <div className="card"><EmptyState title={hasActiveFilters ? 'کاربری با این فیلترها یافت نشد' : 'کاربری یافت نشد'} description={hasActiveFilters ? 'عبارت جستجو یا نقش انتخابی را تغییر دهید.' : 'اولین کاربر را ایجاد کنید'} action={hasActiveFilters ? <button onClick={clearFilters} className="btn-secondary">پاک کردن فیلترها</button> : <button onClick={openCreate} className="btn-primary">ایجاد کاربر</button>} /></div>
      ) : (
        <div className="card overflow-visible">
          <div data-testid="user-mobile-list" className="divide-y divide-gray-100 sm:hidden">
            {users.map((user) => (
              <article key={user.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--c-100)] text-sm font-bold text-[color:var(--c-700)]">
                      {user.full_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold leading-6 text-slate-800">{user.full_name}</p>
                      <p className="break-all text-xs text-gray-400" dir="ltr">@{user.username}</p>
                    </div>
                  </div>
                  <ActionMenu
                    label={`عملیات کاربر ${user.full_name}`}
                    items={getUserActions(user)}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-50 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <RoleBadge role={user.role} />
                    <UserStatus isActive={user.is_active} />
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(user.created_at)}</span>
                </div>
              </article>
            ))}
          </div>

          <div data-testid="user-desktop-table" className="hidden overflow-x-auto rounded-t-xl sm:block">
            <table className="responsive-table w-full min-w-[680px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500">کاربر</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">نقش</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">وضعیت</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">تاریخ ایجاد</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((user) => (
                  <tr key={user.id} className="table-row">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--c-100)] text-sm font-bold text-[color:var(--c-700)]">
                          {user.full_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-xs truncate text-sm font-semibold leading-6 text-slate-800" title={user.full_name}>{user.full_name}</p>
                          <p className="max-w-xs truncate text-xs text-gray-400" dir="ltr">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-4 hidden md:table-cell"><UserStatus isActive={user.is_active} /></td>
                    <td className="px-4 py-4 hidden lg:table-cell text-xs text-gray-400">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end">
                        <ActionMenu
                          label={`عملیات کاربر ${user.full_name}`}
                          items={getUserActions(user)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalUsers > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50/60 px-4 sm:px-5 py-4">
              <p className="text-xs text-gray-500">
                نمایش {formatNumber(((page - 1) * USERS_PER_PAGE) + 1)} تا {formatNumber(Math.min(page * USERS_PER_PAGE, totalUsers))} از {formatNumber(totalUsers)} کاربر
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn-secondary min-w-16 whitespace-nowrap !px-3 !py-1.5 disabled:opacity-40"
                >
                  قبلی
                </button>
                <span className="min-w-20 whitespace-nowrap text-center text-xs font-semibold text-gray-600">
                  صفحه {formatNumber(page)} از {formatNumber(Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE)))}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.min(Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE)), current + 1))}
                  disabled={page >= Math.ceil(totalUsers / USERS_PER_PAGE)}
                  className="btn-secondary min-w-16 whitespace-nowrap !px-3 !py-1.5 disabled:opacity-40"
                >
                  بعدی
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? 'ویرایش کاربر' : 'کاربر جدید'}
        size="md"
        dismissible={!saving}
        busy={saving}
        bodyClassName="p-4 sm:p-6"
        footer={(
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <button type="submit" form={userFormId} disabled={saving} className="btn-primary flex items-center justify-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editUser ? 'ذخیره تغییرات' : 'ایجاد کاربر'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} className="btn-secondary">انصراف</button>
          </div>
        )}
      >
        <form id={userFormId} onSubmit={handleSave} className="space-y-4" noValidate>
          <ModalErrorSummary ref={errorSummaryRef} errors={Object.values(errors).filter(Boolean)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${userFieldPrefix}-full-name`} className="label">نام و نام خانوادگی <span className="text-red-500">*</span></label>
              <input id={`${userFieldPrefix}-full-name`} value={form.full_name} onChange={set('full_name')} className={`input-field ${errors.full_name ? 'border-red-400' : ''}`} placeholder="نام کامل" aria-invalid={!!errors.full_name || undefined} aria-describedby={errors.full_name ? `${userFieldPrefix}-full-name-error` : undefined} />
              {errors.full_name && <p id={`${userFieldPrefix}-full-name-error`} role="alert" className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
            </div>
            <div>
              <label htmlFor={`${userFieldPrefix}-username`} className="label">نام کاربری {!editUser && <span className="text-red-500">*</span>}</label>
              {editUser ? (
                <div id={`${userFieldPrefix}-username`} className="input-field bg-gray-50 text-gray-500 cursor-default flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <span className="font-mono text-sm">{form.username}</span>
                  <span className="text-xs text-gray-400 mr-auto">نام کاربری قابل تغییر نیست</span>
                </div>
              ) : (
                <>
                  <input id={`${userFieldPrefix}-username`} value={form.username} onChange={set('username')} className={`input-field ${errors.username ? 'border-red-400' : ''}`} placeholder="username" aria-invalid={!!errors.username || undefined} aria-describedby={errors.username ? `${userFieldPrefix}-username-error` : undefined} />
                  {errors.username && <p id={`${userFieldPrefix}-username-error`} role="alert" className="text-xs text-red-500 mt-1">{errors.username}</p>}
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">نقش</label>
              <Select
                value={form.role}
                onChange={v => setForm(f => ({ ...f, role: v as typeof f.role }))}
                options={[
                  { value: 'employee', label: 'کارمند' },
                  { value: 'admin', label: 'مدیر' },
                ]}
              />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-[color:var(--c-600)]" />
                <span className="text-sm text-gray-700">حساب فعال</span>
              </label>
            </div>
          </div>
          {!editUser && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor={`${userFieldPrefix}-password`} className="label">رمز عبور <span className="text-red-500">*</span></label>
                <PasswordInput id={`${userFieldPrefix}-password`} value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="رمز عبور" error={!!errors.password} ariaDescribedBy={errors.password ? `${userFieldPrefix}-password-error` : undefined} />
                {errors.password && <p id={`${userFieldPrefix}-password-error`} role="alert" className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
              <div>
                <label htmlFor={`${userFieldPrefix}-password-confirm`} className="label">تکرار رمز عبور <span className="text-red-500">*</span></label>
                <PasswordInput id={`${userFieldPrefix}-password-confirm`} value={form.password_confirm} onChange={v => setForm(f => ({ ...f, password_confirm: v }))} placeholder="تکرار رمز عبور" error={!!errors.password_confirm} ariaDescribedBy={errors.password_confirm ? `${userFieldPrefix}-password-confirm-error` : undefined} />
                {errors.password_confirm && <p id={`${userFieldPrefix}-password-confirm-error`} role="alert" className="text-xs text-red-500 mt-1">{errors.password_confirm}</p>}
              </div>
            </div>
          )}
        </form>
      </Modal>
      <Modal
        open={!!resetId}
        onClose={closeResetModal}
        title="تغییر رمز عبور"
        size="sm"
        dismissible={!resetting}
        busy={resetting}
        bodyClassName="p-4 sm:p-6"
        footer={(
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <button type="button" onClick={requestReset} disabled={resetting || !newPass || !newPassConfirm} className="btn-primary">تغییر رمز</button>
            <button type="button" onClick={closeResetModal} disabled={resetting} className="btn-secondary">انصراف</button>
          </div>
        )}
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">کاربر در اولین ورود بعدی ملزم به تغییر این رمز خواهد بود.</p>
          <div>
            <label htmlFor={`${userFieldPrefix}-reset-password`} className="label">رمز عبور جدید</label>
            <PasswordInput id={`${userFieldPrefix}-reset-password`} value={newPass} onChange={setNewPass} placeholder="رمز عبور جدید" error={!!resetErr} ariaDescribedBy={resetErr ? `${userFieldPrefix}-reset-password-error` : undefined} />
          </div>
          <div>
            <label htmlFor={`${userFieldPrefix}-reset-password-confirm`} className="label">تکرار رمز عبور</label>
            <PasswordInput id={`${userFieldPrefix}-reset-password-confirm`} value={newPassConfirm} onChange={setNewPassConfirm} placeholder="رمز عبور جدید را دوباره وارد کنید" error={!!resetErr} ariaDescribedBy={resetErr ? `${userFieldPrefix}-reset-password-error` : undefined} />
          </div>
          {resetErr && <p id={`${userFieldPrefix}-reset-password-error`} role="alert" className="text-xs text-red-500">{resetErr}</p>}
        </div>
      </Modal>

      <ConfirmModal
        open={resetConfirmOpen}
        onClose={() => !resetting && setResetConfirmOpen(false)}
        onConfirm={handleResetPassword}
        title="تأیید تغییر رمز عبور"
        message="آیا از تغییر رمز عبور این کاربر اطمینان دارید؟"
        confirmLabel="بله، تغییر بده"
        confirmVariant="primary"
        loading={resetting}
      />
      <Modal
        open={importModalOpen}
        onClose={() => { setImportModalOpen(false); setImportResult(null); setIsDragging(false); }}
        title="آپلود کاربران از فایل"
        size="lg"
        dismissible={!importing}
        busy={importing}
        bodyClassName="p-4 sm:p-6"
        footer={(
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={!importFile || importing}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {importing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {importing ? 'در حال ساخت حساب‌ها...' : 'آپلود و ایجاد کاربران'}
            </button>
            <button type="button" onClick={() => { setImportModalOpen(false); setImportResult(null); setIsDragging(false); }} disabled={importing} className="btn-secondary">بستن</button>
          </div>
        )}
      >
        <div className="space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-600 leading-relaxed border border-gray-100">
            <p className="text-gray-400 mb-2 font-sans font-medium text-xs">فرمت فایل CSV یا TXT (هر خط یک کاربر):</p>
            <p>username,نام کامل,رمز عبور,نقش</p>
            <p className="text-gray-400 mt-1"># نقش اختیاری است: employee (پیش‌فرض) یا admin</p>
            <p className="text-gray-400"># خطوط شروع‌شده با # نادیده گرفته می‌شوند</p>
            <p className="text-gray-400"># فایل‌های بزرگ به‌صورت دسته‌ای پردازش می‌شوند؛ نتیجه فقط موارد ضروری را نمایش می‌دهد.</p>
            <div className="border-t border-gray-200 mt-2 pt-2 space-y-0.5">
              <p>ali_ahmadi,علی احمدی,Pass@1234,employee</p>
              <p>sara.mohammadi,سارا محمدی,MyPass!99</p>
              <p>manager1,مدیر اول,Admin@2024,admin</p>
            </div>
          </div>
          <div
            className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-colors
              ${isDragging ? 'border-[color:var(--c-400)] bg-[color:var(--c-50)] scale-[1.01]' :
                importFile ? 'border-[color:var(--c-300)] bg-[color:var(--c-50)]' :
                'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
            onDrop={e => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              const ext = file.name.split('.').pop()?.toLowerCase();
              if (ext !== 'csv' && ext !== 'txt') {
                toast.error('فقط فایل‌های CSV و TXT مجاز هستند');
                return;
              }
              setImportFile(file);
              setImportResult(null);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={e => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
            />
            {importFile ? (
              <div className="flex items-center justify-center gap-3">
                <svg className="w-8 h-8 text-[color:var(--c-500)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="text-right">
                  <p className="font-medium text-slate-700">{importFile.name}</p>
                  <p className="text-xs text-gray-400">{formatNumber(importFile.size / 1024, 1)} KB — کلیک کنید تا تغییر دهید</p>
                </div>
              </div>
            ) : (
              <>
                <svg className={`w-10 h-10 mx-auto mb-2 transition-colors ${isDragging ? 'text-[color:var(--c-400)]' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className={`text-sm transition-colors ${isDragging ? 'text-[color:var(--c-600)] font-medium' : 'text-gray-500'}`}>
                  {isDragging ? 'رها کنید...' : 'فایل CSV یا TXT را اینجا رها کنید یا کلیک کنید'}
                </p>
              </>
            )}
          </div>
{importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{formatNumber(importResult.created_count)}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">ایجاد شد</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{formatNumber(importResult.skipped_count)}</p>
                  <p className="text-xs text-amber-600 mt-0.5">نادیده گرفته شد</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{formatNumber(importResult.error_count)}</p>
                  <p className="text-xs text-red-600 mt-0.5">خطا</p>
                </div>
              </div>

              {importResult.skipped.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">نادیده گرفته‌شده‌ها:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {importResult.skipped.map((s, i) => (
                      <p key={`${s.line}-${s.username}-${i}`} className="text-xs text-amber-700">خط {formatNumber(s.line)}: {s.username} — {s.reason}</p>
                    ))}
                  </div>
                  {importResult.skipped_details_omitted > 0 && (
                    <p className="text-xs text-amber-700 mt-2">و {formatNumber(importResult.skipped_details_omitted)} مورد دیگر نمایش داده نمی‌شود.</p>
                  )}
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1.5">خطاها:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {importResult.errors.map((e, i) => (
                      <p key={`${e.line}-${i}`} className="text-xs text-red-700">خط {formatNumber(e.line)}: {e.error}</p>
                    ))}
                  </div>
                  {importResult.error_details_omitted > 0 && (
                    <p className="text-xs text-red-700 mt-2">و {formatNumber(importResult.error_details_omitted)} مورد دیگر نمایش داده نمی‌شود.</p>
                  )}
                </div>
              )}

              {importResult.created_details_omitted > 0 && (
                <p className="text-xs text-gray-500">جزئیات {formatNumber(importResult.created_details_omitted)} کاربر ایجادشده برای حفظ سرعت نمایش داده نمی‌شود.</p>
              )}
            </div>
          )}

        </div>
      </Modal>
      <Modal
        open={!!deleteUserId}
        onClose={() => setDeleteUserId(null)}
        title="حذف کاربر"
        size="sm"
        dismissible={!deletingUser}
        busy={deletingUser}
        bodyClassName="p-5 sm:p-6"
        footer={(
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <button type="button" onClick={handleDeleteUser} disabled={deletingUser} className="btn-danger flex items-center justify-center gap-2">
              {deletingUser && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              بله، حذف شود
            </button>
            <button type="button" onClick={() => setDeleteUserId(null)} disabled={deletingUser} className="btn-secondary">انصراف</button>
          </div>
        )}
      >
        <div>
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 18.333 3.924 20 5.464 20z"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">آیا مطمئن هستید؟</p>
              <p className="text-xs text-red-600 mt-1">
                حساب کاربری <strong>{users.find(u => u.id === deleteUserId)?.full_name}</strong> برای همیشه حذف می‌شود.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
