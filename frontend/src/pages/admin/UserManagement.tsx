import { useEffect, useState, useCallback, FormEvent, useRef } from 'react';
import { adminUserApi, dashboardApi } from '../../api/endpoints';
import { BulkImportResult, PaginatedResponse, User } from '../../types';
import { PageHeader, SearchInput, EmptyState, PageLoader, ConfirmModal, Modal, PasswordInput } from '../../components/common/index';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

function RoleBadge({ role }: { role: string }) {
  return role === 'admin'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">مدیر</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[color:var(--c-50)] text-[color:var(--c-700)] border border-[color:var(--c-200)]">کارمند</span>;
}

interface UserFormData {
  username: string; full_name: string; role: string; password: string; password_confirm: string; is_active: boolean;
}
const emptyForm: UserFormData = { username: '', full_name: '', role: 'employee', password: '', password_confirm: '', is_active: true };
const USERS_PER_PAGE = 50;


export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
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


  const [deleteAllModal, setDeleteAllModal] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    const params: Record<string, string> = {
      page: String(page),
      page_size: String(USERS_PER_PAGE),
    };
    if (search.trim()) params.search = search.trim();
    if (roleFilter) params.role = roleFilter;

    try {
      const response = await adminUserApi.list(params);
      const payload = response.data as PaginatedResponse<User>;
      setUsers(payload.results || []);
      setTotalUsers(payload.count || 0);
    } catch (error) {
      setUsers([]);
      setTotalUsers(0);
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshFirstPage = () => {
    if (page === 1) {
      void load();
    } else {
      setPage(1);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRoleChange = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  const openCreate = () => { setEditUser(null); setForm(emptyForm); setErrors({}); setModalOpen(true); };
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
        toast.success(`${r.data.created_count} کاربر ایجاد شد`);
        refreshFirstPage();
      }
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setImporting(false); }
  };

  const handleDeleteAll = async () => {
    if (deleteAllConfirmText !== 'حذف همه') return;
    setDeletingAll(true);
    try {
      const r = await dashboardApi.deleteAllData();
      const d = (r.data as any).deleted;
      toast.success(`${d.employees} کارمند، ${d.surveys} نظرسنجی، ${d.people} فرد و ${d.ratings} امتیاز حذف شدند`);
      setDeleteAllModal(false);
      setDeleteAllConfirmText('');
      refreshFirstPage();
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeletingAll(false); }
  };

  const set = (field: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors(er => ({ ...er, [field]: '' }));
  };

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

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1"><SearchInput value={search} onChange={handleSearchChange} placeholder="جستجو بر اساس نام یا نام کاربری..." /></div>
        <select value={roleFilter} onChange={e => handleRoleChange(e.target.value)} className="input-field w-full sm:w-36">
          <option value="">همه نقش‌ها</option>
          <option value="admin">مدیر</option>
          <option value="employee">کارمند</option>
        </select>
      </div>

      {loading ? <PageLoader /> : loadError ? (
        <div className="card">
          <EmptyState
            title="دریافت کارکنان ناموفق بود"
            description={loadError}
            action={<button onClick={() => void load()} className="btn-primary">تلاش دوباره</button>}
          />
        </div>
      ) : users.length === 0 ? (
        <div className="card"><EmptyState title="کاربری یافت نشد" description="اولین کاربر را ایجاد کنید" action={<button onClick={openCreate} className="btn-primary">ایجاد کاربر</button>} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="responsive-table w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-right px-4 sm:px-6 py-3 text-xs font-semibold text-gray-500">کاربر</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">نقش</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">وضعیت</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">تاریخ ایجاد</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(user => (
                  <tr key={user.id} className="table-row">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[color:var(--c-100)] flex items-center justify-center text-[color:var(--c-700)] text-sm font-bold flex-shrink-0">
                          {user.full_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{user.full_name}</p>
                          <p className="text-xs text-gray-400">{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden md:table-cell"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-4 hidden md:table-cell">
                      {user.is_active
                        ? <span className="text-xs text-emerald-600 font-medium">فعال</span>
                        : <span className="text-xs text-red-500 font-medium">غیرفعال</span>}
                    </td>
                    <td className="px-4 py-4 hidden lg:table-cell text-xs text-gray-400">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-1 justify-end whitespace-nowrap">
                        <button onClick={() => openEdit(user)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">ویرایش</button>
                        <button onClick={() => { setResetId(user.id); setNewPass(''); }} className="px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">رمز عبور</button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${user.is_active ? 'text-orange-600 hover:bg-orange-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        >
                          {user.is_active ? 'غیرفعال' : 'فعال'}
                        </button>
                        <button
                          onClick={() => setDeleteUserId(user.id)}
                          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalUsers > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-5 py-4 border-t border-gray-100 bg-gray-50/60">
              <p className="text-xs text-gray-500">
                نمایش {((page - 1) * USERS_PER_PAGE) + 1} تا {Math.min(page * USERS_PER_PAGE, totalUsers)} از {totalUsers} کاربر
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(current => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="btn-secondary !px-3 !py-1.5 disabled:opacity-40"
                >
                  قبلی
                </button>
                <span className="min-w-20 text-center text-xs font-semibold text-gray-600">
                  صفحه {page} از {Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE))}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(current => Math.min(Math.max(1, Math.ceil(totalUsers / USERS_PER_PAGE)), current + 1))}
                  disabled={page >= Math.ceil(totalUsers / USERS_PER_PAGE)}
                  className="btn-secondary !px-3 !py-1.5 disabled:opacity-40"
                >
                  بعدی
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {}
      <div className="mt-10 border border-red-200 rounded-xl p-5 bg-red-50">
        <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between gap-3">
          <div>
            <p className="font-semibold text-red-700 text-sm">ناحیه خطر</p>
            <p className="text-xs text-red-500 mt-0.5">حذف تمام نظرسنجی‌ها، افراد و امتیازها — غیرقابل بازگشت</p>
          </div>
          <button
            onClick={() => { setDeleteAllModal(true); setDeleteAllConfirmText(''); }}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-100 transition-colors"
          >
            حذف تمام داده‌ها
          </button>
        </div>
      </div>

      {}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'ویرایش کاربر' : 'کاربر جدید'} size="md">
        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">نام و نام خانوادگی <span className="text-red-500">*</span></label>
              <input value={form.full_name} onChange={set('full_name')} className={`input-field ${errors.full_name ? 'border-red-400' : ''}`} placeholder="نام کامل" />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
            </div>
            <div>
              <label className="label">نام کاربری {!editUser && <span className="text-red-500">*</span>}</label>
              {editUser ? (
                <div className="input-field bg-gray-50 text-gray-500 cursor-default flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <span className="font-mono text-sm">{form.username}</span>
                  <span className="text-xs text-gray-400 mr-auto">نام کاربری قابل تغییر نیست</span>
                </div>
              ) : (
                <>
                  <input value={form.username} onChange={set('username')} className={`input-field ${errors.username ? 'border-red-400' : ''}`} placeholder="username" />
                  {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">نقش</label>
              <select value={form.role} onChange={set('role')} className="input-field">
                <option value="employee">کارمند</option>
                <option value="admin">مدیر</option>
              </select>
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
                <label className="label">رمز عبور <span className="text-red-500">*</span></label>
                <PasswordInput value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} placeholder="رمز عبور" error={!!errors.password} />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="label">تکرار رمز عبور <span className="text-red-500">*</span></label>
                <PasswordInput value={form.password_confirm} onChange={v => setForm(f => ({ ...f, password_confirm: v }))} placeholder="تکرار رمز عبور" error={!!errors.password_confirm} />
                {errors.password_confirm && <p className="text-xs text-red-500 mt-1">{errors.password_confirm}</p>}
              </div>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editUser ? 'ذخیره تغییرات' : 'ایجاد کاربر'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary w-full sm:w-auto">انصراف</button>
          </div>
        </form>
      </Modal>

      {}
      <Modal open={!!resetId} onClose={closeResetModal} title="تغییر رمز عبور" size="sm">
        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-xs text-gray-500">کاربر در اولین ورود بعدی ملزم به تغییر این رمز خواهد بود.</p>
          <div>
            <label className="label">رمز عبور جدید</label>
            <PasswordInput value={newPass} onChange={setNewPass} placeholder="رمز عبور جدید" autoFocus error={!!resetErr} />
          </div>
          <div>
            <label className="label">تکرار رمز عبور</label>
            <PasswordInput value={newPassConfirm} onChange={setNewPassConfirm} placeholder="رمز عبور جدید را دوباره وارد کنید" error={!!resetErr} />
          </div>
          {resetErr && <p className="text-xs text-red-500">{resetErr}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button onClick={requestReset} disabled={resetting || !newPass || !newPassConfirm} className="btn-primary w-full sm:w-auto flex items-center gap-2">
              تغییر رمز
            </button>
            <button onClick={closeResetModal} className="btn-secondary w-full sm:w-auto">انصراف</button>
          </div>
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

      {}
      <Modal open={importModalOpen} onClose={() => { setImportModalOpen(false); setImportResult(null); setIsDragging(false); }} title="آپلود کاربران از فایل" size="lg">
        <div className="p-4 sm:p-6 space-y-5">
          {}
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

          {}
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
                  <p className="text-xs text-gray-400">{(importFile.size / 1024).toFixed(1)} KB — کلیک کنید تا تغییر دهید</p>
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

          {}
          {importResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-700">{importResult.created_count}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">ایجاد شد</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{importResult.skipped_count}</p>
                  <p className="text-xs text-amber-600 mt-0.5">نادیده گرفته شد</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-700">{importResult.error_count}</p>
                  <p className="text-xs text-red-600 mt-0.5">خطا</p>
                </div>
              </div>

              {importResult.skipped.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">نادیده گرفته‌شده‌ها:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {importResult.skipped.map((s, i) => (
                      <p key={`${s.line}-${s.username}-${i}`} className="text-xs text-amber-700">خط {s.line}: {s.username} — {s.reason}</p>
                    ))}
                  </div>
                  {importResult.skipped_details_omitted > 0 && (
                    <p className="text-xs text-amber-700 mt-2">و {importResult.skipped_details_omitted} مورد دیگر نمایش داده نمی‌شود.</p>
                  )}
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1.5">خطاها:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {importResult.errors.map((e, i) => (
                      <p key={`${e.line}-${i}`} className="text-xs text-red-700">خط {e.line}: {e.error}</p>
                    ))}
                  </div>
                  {importResult.error_details_omitted > 0 && (
                    <p className="text-xs text-red-700 mt-2">و {importResult.error_details_omitted} مورد دیگر نمایش داده نمی‌شود.</p>
                  )}
                </div>
              )}

              {importResult.created_details_omitted > 0 && (
                <p className="text-xs text-gray-500">جزئیات {importResult.created_details_omitted} کاربر ایجادشده برای حفظ سرعت نمایش داده نمی‌شود.</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={!importFile || importing}
              className="btn-primary flex items-center gap-2"
            >
              {importing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {importing ? 'در حال ساخت حساب‌ها...' : 'آپلود و ایجاد کاربران'}
            </button>
            <button onClick={() => { setImportModalOpen(false); setImportResult(null); setIsDragging(false); }} className="btn-secondary">بستن</button>
          </div>
        </div>
      </Modal>

      {}
      <Modal open={deleteAllModal} onClose={() => setDeleteAllModal(false)} title="حذف تمام داده‌ها" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 18.333 3.924 20 5.464 20z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">این عملیات غیرقابل بازگشت است</p>
              <p className="text-xs text-red-600 mt-1">تمام نظرسنجی‌ها، افراد و امتیازها برای همیشه حذف می‌شوند. حساب‌های کاربری دست نخورده باقی می‌مانند.</p>
            </div>
          </div>
          <div>
            <label className="label">برای تأیید، عبارت «حذف همه» را تایپ کنید</label>
            <input
              value={deleteAllConfirmText}
              onChange={e => setDeleteAllConfirmText(e.target.value)}
              className="input-field"
              placeholder="حذف همه"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDeleteAll}
              disabled={deleteAllConfirmText !== 'حذف همه' || deletingAll}
              className="flex-1 py-2.5 text-sm font-medium rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-2"
            >
              {deletingAll && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              حذف تمام داده‌ها
            </button>
            <button onClick={() => setDeleteAllModal(false)} className="btn-secondary">انصراف</button>
          </div>
        </div>
      </Modal>
      {}
      <Modal open={!!deleteUserId} onClose={() => setDeleteUserId(null)} title="حذف کاربر" size="sm">
        <div className="p-6 space-y-4">
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
          <div className="flex gap-3">
            <button
              onClick={handleDeleteUser}
              disabled={deletingUser}
              className="btn-danger flex items-center gap-2"
            >
              {deletingUser && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>}
              بله، حذف شود
            </button>
            <button onClick={() => setDeleteUserId(null)} className="btn-secondary">انصراف</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
