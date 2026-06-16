import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminSurveyApi } from '../../api/endpoints';
import { Survey } from '../../types';
import { PageHeader, PageLoader } from '../../components/common/index';
import { getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

const visibilityOptions = [
  { value: 'admin_only', label: 'فقط مدیر' },
];

export default function SurveyForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(isEdit);
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState<{
    title: string;
    question: string;
    description: string;
    results_visibility: 'admin_only' | 'employees_after_close';
  }>({
    title:              '',
    question:           '',
    description:        '',
    results_visibility: 'admin_only',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEdit) return;
    adminSurveyApi.get(Number(id))
      .then(r => {
        const s: Survey = r.data;
        setForm({
          title:              s.title,
          question:           s.question,
          description:        s.description,
          results_visibility: 'admin_only',
        });
      })
      .catch(() => { toast.error('خطا در بارگذاری نظرسنجی'); navigate('/admin/surveys'); })
      .finally(() => setLoading(false));
  }, [id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim())    e.title    = 'عنوان الزامی است';
    if (!form.question.trim()) e.question = 'سوال اصلی الزامی است';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await adminSurveyApi.update(Number(id), form);
        toast.success('تغییرات ذخیره شد');
        navigate(`/admin/surveys/${id}`);
      } else {
        const r = await adminSurveyApi.create(form);
        toast.success('نظرسنجی ایجاد شد');
        navigate(`/admin/surveys/${r.data.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(f => ({ ...f, [field]: e.target.value }) as typeof f);
      if (errors[field]) setErrors(er => ({ ...er, [field]: '' }));
    };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={isEdit ? 'ویرایش نظرسنجی' : 'نظرسنجی جدید'}
        subtitle={isEdit ? 'اطلاعات نظرسنجی را ویرایش کنید' : 'اطلاعات نظرسنجی جدید را وارد کنید'}
      />

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Title */}
        <div>
          <label className="label">عنوان نظرسنجی <span className="text-red-500">*</span></label>
          <input
            type="text" value={form.title} onChange={set('title')}
            className={`input-field ${errors.title ? 'border-red-400' : ''}`}
            placeholder="مثال: نظرسنجی ارزیابی عملکرد کارکنان"
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Question */}
        <div>
          <label className="label">سوال اصلی <span className="text-red-500">*</span></label>
          <textarea
            value={form.question} onChange={set('question')} rows={3}
            className={`input-field resize-none ${errors.question ? 'border-red-400' : ''}`}
            placeholder="مثال: عملکرد این فرد را در سال گذشته چگونه ارزیابی می‌کنید؟"
          />
          {errors.question && <p className="text-xs text-red-500 mt-1">{errors.question}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="label">توضیحات / راهنمای شرکت‌کنندگان</label>
          <textarea
            value={form.description} onChange={set('description')} rows={3}
            className="input-field resize-none"
            placeholder="توضیحات یا راهنمایی برای شرکت‌کنندگان..."
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isEdit ? 'ذخیره تغییرات' : 'ایجاد نظرسنجی'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">انصراف</button>
        </div>
      </form>
    </div>
  );
}
