import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminSurveyApi } from '../../api/endpoints';
import type { SurveyResults, PersonResult } from '../../types';
import { PageLoader } from '../../components/common/index';
import { downloadBlob, getErrorMessage } from '../../utils/helpers';
import toast from 'react-hot-toast';

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold text-sm">۱</div>;
  if (rank === 2) return <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold text-sm">۲</div>;
  if (rank === 3) return <div className="w-8 h-8 rounded-full bg-amber-700 flex items-center justify-center text-white font-bold text-sm">۳</div>;
  return <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold text-sm">{rank.toLocaleString('fa-IR')}</div>;
}

function ScoreBar({ value, max = 10 }: { value: number | null; max?: number }) {
  const pct = value ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-10 text-left">
        {value !== null ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
}

export default function SurveyResults() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const surveyId = Number(id);

  useEffect(() => {
    adminSurveyApi.results(surveyId)
      .then(r => setData(r.data))
      .catch(() => toast.error('خطا در بارگذاری نتایج'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleExport = async (type: 'csv' | 'excel') => {
    setExporting(type);
    try {
      const r = type === 'csv'
        ? await adminSurveyApi.exportCsv(surveyId)
        : await adminSurveyApi.exportExcel(surveyId);
      downloadBlob(r.data as Blob, `results_${surveyId}.${type === 'csv' ? 'csv' : 'xlsx'}`);
      toast.success('فایل دانلود شد');
    } catch (err) { toast.error(getErrorMessage(err)); }
    finally { setExporting(null); }
  };

  if (loading) return <PageLoader />;
  if (!data) return null;

  const { survey, results } = data;

  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-5">
        <Link to="/admin/surveys" className="hover:text-gray-600">نظرسنجی‌ها</Link>
        <span>/</span>
        <Link to={`/admin/surveys/${id}`} className="hover:text-gray-600">{survey.title}</Link>
        <span>/</span>
        <span className="text-gray-700">نتایج</span>
      </div>

      {/* Header card */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 mb-1">{survey.title}</h1>
            <p className="text-gray-500 text-sm">{survey.question}</p>
            <p className="text-xs text-gray-400 mt-2">
              {results.length} نفر — {results.reduce((s, r) => s + r.votes_count, 0)} رأی ثبت شده
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => handleExport('csv')}
              disabled={!!exporting}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {exporting === 'csv' ? <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              CSV
            </button>
            <button
              onClick={() => handleExport('excel')}
              disabled={!!exporting}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              {exporting === 'excel' ? <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Results list */}
      {results.length === 0 ? (
        <div className="card py-16 text-center text-gray-400">
          <p>هنوز امتیازی ثبت نشده است</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r: PersonResult) => (
            <div
              key={r.person_id}
              className={`card p-5 flex items-center gap-4 ${r.rank === 1 ? 'border-amber-200 ring-1 ring-amber-100' : ''}`}
            >
              <RankBadge rank={r.rank} />

              {/* Photo */}
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                {r.photo_url ? (
                  <img src={r.photo_url} alt={r.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                    {r.full_name[0]}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{r.full_name}</p>
                <p className="text-xs text-gray-400">{[r.role_title, r.department].filter(Boolean).join(' — ')}</p>
                <div className="mt-2">
                  <ScoreBar value={r.average_score} />
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-5 flex-shrink-0 text-center hidden sm:flex">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">میانگین</p>
                  <p className="text-lg font-bold text-blue-600">
                    {r.average_score !== null ? r.average_score.toFixed(1) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">رأی</p>
                  <p className="text-lg font-bold text-slate-700">{r.votes_count.toLocaleString('fa-IR')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">مجموع</p>
                  <p className="text-lg font-bold text-slate-700">{r.total_score.toLocaleString('fa-IR')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">
        نتایج کاملاً ناشناس هستند — هیچ اطلاعاتی از هویت رأی‌دهندگان نمایش داده نمی‌شود
      </p>
    </div>
  );
}
