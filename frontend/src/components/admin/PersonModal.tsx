import { useEffect, useRef, useState, FormEvent } from 'react';
import { Modal } from '../common/index';
import { adminPersonApi } from '../../api/endpoints';
import { SurveyPerson } from '../../types';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  surveyId: number;
  person?: SurveyPerson;
}

export default function PersonModal({ open, onClose, onSaved, surveyId, person }: Props) {
  const isEdit = !!person;
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ full_name: '', role_title: '', department: '', description: '', display_order: '0', is_active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (person) {
        setForm({
          full_name: person.full_name,
          role_title: person.role_title,
          department: person.department,
          description: person.description,
          display_order: String(person.display_order),
          is_active: person.is_active,
        });
        setPreview(person.photo_url || null);
      } else {
        setForm({ full_name: '', role_title: '', department: '', description: '', display_order: '0', is_active: true });
        setPreview(null);
      }
      setFile(null);
      setErrors({});
    }
  }, [open, person]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(f.type)) { toast.error('فقط فرمت‌های jpg، png و webp مجاز هستند'); return; }
    if (f.size > 2 * 1024 * 1024) { toast.error('حجم فایل نباید از ۲ مگابایت بیشتر باشد'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.full_name.trim()) e.full_name = 'نام و نام خانوادگی الزامی است';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const fd = new FormData();
    fd.append('full_name', form.full_name.trim());
    fd.append('role_title', form.role_title.trim());
    fd.append('department', form.department.trim());
    fd.append('description', form.description.trim());
    fd.append('display_order', form.display_order);
    fd.append('is_active', String(form.is_active));
    if (file) fd.append('photo', file);

    try {
      if (isEdit) {
        await adminPersonApi.update(person!.id, fd);
        toast.success('اطلاعات فرد ذخیره شد');
      } else {
        await adminPersonApi.create(surveyId, fd);
        toast.success('فرد با موفقیت اضافه شد');
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors(er => ({ ...er, [field]: '' }));
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'ویرایش فرد' : 'افزودن فرد'} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Photo upload */}
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center cursor-pointer border-2 border-dashed border-gray-200 hover:border-blue-400 transition-colors flex-shrink-0"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="پیش‌نمایش" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            )}
          </div>
          <div>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-sm">
              {preview ? 'تغییر تصویر' : 'انتخاب تصویر'}
            </button>
            <p className="text-xs text-gray-400 mt-1">jpg, png, webp — حداکثر ۲ مگابایت</p>
            <input ref={fileRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="label">نام و نام خانوادگی <span className="text-red-500">*</span></label>
          <input type="text" value={form.full_name} onChange={set('full_name')} className={`input-field ${errors.full_name ? 'border-red-400' : ''}`} placeholder="مثال: علی رضایی" />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">سمت</label>
            <input type="text" value={form.role_title} onChange={set('role_title')} className="input-field" placeholder="مثال: کارشناس IT" />
          </div>
          <div>
            <label className="label">واحد سازمانی</label>
            <input type="text" value={form.department} onChange={set('department')} className="input-field" placeholder="مثال: فناوری اطلاعات" />
          </div>
        </div>

        <div>
          <label className="label">توضیحات</label>
          <textarea value={form.description} onChange={set('description')} rows={2} className="input-field resize-none" placeholder="توضیح کوتاه درباره این فرد..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">ترتیب نمایش</label>
            <input type="number" min="0" value={form.display_order} onChange={set('display_order')} className="input-field" />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">فعال</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isEdit ? 'ذخیره تغییرات' : 'افزودن فرد'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary" disabled={saving}>انصراف</button>
        </div>
      </form>
    </Modal>
  );
}
