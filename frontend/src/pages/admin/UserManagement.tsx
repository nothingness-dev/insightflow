import { useEffect, useState, useCallback, FormEvent } from 'react';
import { adminUserApi } from '../../api/endpoints';
import { User } from '../../types';
import { PageHeader, SearchInput, EmptyState, PageLoader, ConfirmModal, Modal } from '../../components/common/index';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

function RoleBadge({ role }: { role: string }) {
  return role === 'admin'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">مدیر</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">کارمند</span>;
}

interface UserFormData {
  username: string; full_name: string; role: string; password: string; password_confirm: string; is_active: boolean;
}

const emptyForm: UserFormData = { username: '', full_name: '', role: 'employee', password: '', password_confirm: '', is_active: true };

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivateId, setDeactivateId] = useState<number | null>(null);
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPass, setNewPass] = useState('');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    adminUserApi.list(params)
      .then(r => setUsers(Array.isArray(r.data) ? r.data : (r.data as any).results || []))
      .finally(() => setLoading(false));
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);

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
        setUsers(u => [r.data, ...u]);
        toast.success('کاربر ایجاد شد');
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

  const handleResetPassword = async () => {
    if (!resetId || !newPass) return;
    setResetting(true);
    try {
      await adminUserApi.resetPassword(resetId, newPass);
      toast.success('رمز عبور تغییر یافت');
      setResetId(null);
      setNewPass('');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setResetting(false); }
  };

  const set = (field: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors(er => ({ ...er, [field]: '' }));
  };

  return (
    <div>
      <PageHeader
        title="مدیریت کارکنان"
        subtitle="ایجاد و مدیریت حساب‌های کاربری سازمان"
        action={<button onClick={openCreate} className="btn-primary flex items-center gap-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>کاربر جدید</button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1"><SearchInput value={search} onChange={setSearch} placeholder="جستجو بر اساس نام یا نام کاربری..." /></div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input-field sm:w-36">
          <option value="">همه نقش‌ها</option>
          <option value="admin">مدیر</option>
          <option value="employee">کارمند</option>
        </select>
      </div>

      {loading ? <PageLoader /> : users.length === 0 ? (
        <div className="card"><EmptyState title="کاربری یافت نشد" description="اولین کاربر را ایجاد کنید" action={<button onClick={openCreate} className="btn-primary">ایجاد کاربر</button>} /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500">کاربر</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">نقش</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">وضعیت</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">تاریخ ایجاد</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(user => (
                  <tr key={user.id} className="table-row">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
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
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(user)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">ویرایش</button>
                        <button onClick={() => { setResetId(user.id); setNewPass(''); }} className="px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">رمز عبور</button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${user.is_active ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        >
                          {user.is_active ? 'غیرفعال' : 'فعال'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'ویرایش کاربر' : 'کاربر جدید'} size="md">
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">نام و نام خانوادگی <span className="text-red-500">*</span></label>
              <input value={form.full_name} onChange={set('full_name')} className={`input-field ${errors.full_name ? 'border-red-400' : ''}`} placeholder="نام کامل" />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
            </div>
            <div>
              <label className="label">نام کاربری <span className="text-red-500">*</span></label>
              <input value={form.username} onChange={set('username')} className={`input-field ${errors.username ? 'border-red-400' : ''}`} placeholder="username" disabled={!!editUser} />
              {errors.username && <p className="text-xs text-red-500 mt-1">{errors.username}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">نقش</label>
              <select value={form.role} onChange={set('role')} className="input-field">
                <option value="employee">کارمند</option>
                <option value="admin">مدیر</option>
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                <span className="text-sm text-gray-700">حساب فعال</span>
              </label>
            </div>
          </div>
          {!editUser && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">رمز عبور <span className="text-red-500">*</span></label>
                <input type="password" value={form.password} onChange={set('password')} className={`input-field ${errors.password ? 'border-red-400' : ''}`} placeholder="حداقل ۸ کاراکتر" />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="label">تکرار رمز عبور <span className="text-red-500">*</span></label>
                <input type="password" value={form.password_confirm} onChange={set('password_confirm')} className={`input-field ${errors.password_confirm ? 'border-red-400' : ''}`} placeholder="تکرار رمز عبور" />
                {errors.password_confirm && <p className="text-xs text-red-500 mt-1">{errors.password_confirm}</p>}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editUser ? 'ذخیره تغییرات' : 'ایجاد کاربر'}
            </button>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">انصراف</button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetId} onClose={() => setResetId(null)} title="تغییر رمز عبور" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="label">رمز عبور جدید</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="input-field" placeholder="حداقل ۸ کاراکتر" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleResetPassword} disabled={resetting || !newPass} className="btn-primary flex items-center gap-2">
              {resetting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              تغییر رمز
            </button>
            <button onClick={() => setResetId(null)} className="btn-secondary">انصراف</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
