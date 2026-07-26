import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminSurveyApi } from '../../api/endpoints';
import type { PersonResult, Survey, SurveyResults } from '../../types';
import { ResultsSkeleton } from '../../components/common/index';
import { downloadBlob, getBlobErrorMessage } from '../../utils/helpers';
import { isCanceledRequest } from '../../utils/http';
import toast from 'react-hot-toast';
import { TabOverview, TabPeople, TabQuestions } from './components/SurveyResultsTabs';
import { IPResponseAudit } from './components/IPResponseAudit';
import { fa } from './components/surveyResultsPrimitives';
type Tab = 'overview' | 'questions' | 'people' | 'ip-audit';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',  label: 'خلاصه' },
  { id: 'questions', label: 'تحلیل سوال‌ها' },
  { id: 'people',    label: 'نتایج فردی' },
  { id: 'ip-audit',  label: 'ممیزی پاسخ‌های IP' },
];

function normalizeResultsPayload(payload: SurveyResults): SurveyResults {
  return {
    ...payload,
    survey: (payload?.survey ?? {}) as Survey,
    results: Array.isArray(payload?.results) ? (payload.results as PersonResult[]) : [],
  };
}

export default function SurveyResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'excel' | 'pdf' | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const surveyId = Number(id);

  useEffect(() => {
    if (!Number.isFinite(surveyId)) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setData(null);

    adminSurveyApi.results(surveyId, controller.signal)
      .then(r => setData(normalizeResultsPayload(r.data)))
      .catch(error => {
        if (isCanceledRequest(error, controller.signal)) return;
        toast.error('خطا در بارگذاری نتایج');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [surveyId]);

  const handleExport = async (type: 'csv' | 'excel' | 'pdf') => {
    setExporting(type);


    let downloadStarted = false;
    try {
      const r = type === 'csv'
        ? await adminSurveyApi.exportCsv(surveyId)
        : type === 'excel'
          ? await adminSurveyApi.exportExcel(surveyId)
          : await adminSurveyApi.exportPdf(surveyId);

      const blob = r.data as Blob;


      if (blob.size === 0) {
        throw new Error('فایل خروجی خالی دریافت شد. لطفاً دوباره تلاش کنید.');
      }
      const expectedType = type === 'pdf' ? 'application/pdf'
        : type === 'excel' ? 'application/vnd.openxmlformats'
        : 'text/';
      if (blob.type && !blob.type.includes(expectedType.split('/')[0] === 'text' ? 'text' : expectedType.split('/')[1])) {
        throw new Error('فایل خروجی نامعتبر است. لطفاً دوباره تلاش کنید.');
      }

      const ext = type === 'csv' ? 'csv' : type === 'excel' ? 'xlsx' : 'pdf';
      downloadBlob(blob, `results_${surveyId}.${ext}`);
      downloadStarted = true;
      toast.success('فایل دانلود شد');
    } catch (err) {
      if (!downloadStarted) {
        toast.error(await getBlobErrorMessage(err));
      }
    } finally { setExporting(null); }
  };

  if (loading) {
    return (
      <div className="solid-skeletons">
        <ResultsSkeleton />
      </div>
    );
  }
  if (!data)  return null;

  const survey = data.survey;
  const results = Array.isArray(data.results) ? data.results : [];
  // The general/comparison group only - particular persons (with private
  // questions) must never surface in aggregate counts shown outside their
  // own isolated sections.
  const sharedResults = results.filter(r => r.result_section === 'all' || !r.result_section);
  // "People with a result" must be derived from an actual score, not from the
  // size of the results array (which merely counts evaluated people).
  const scoredCount = results.filter(r => r.average_score != null).length;
  const sharedScoredCount = sharedResults.filter(r => r.average_score != null).length;
  const votersCount = sharedResults.reduce((m, r) => Math.max(m, r.votes_count), 0);

  return (
    <div className="responsive-page max-w-4xl">
<div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400 mb-5">
        <Link to="/admin/surveys" className="hover:text-slate-600 transition-colors">نظرسنجی‌ها</Link>
        <span>/</span>
        <Link to={`/admin/surveys/${id}`} className="hover:text-slate-600 transition-colors truncate max-w-[160px]">{survey.title}</Link>
        <span>/</span>
        <span className="text-slate-700">نتایج</span>
      </div>
<div className="card p-4 sm:p-5 mb-5">
        <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-800 truncate">{survey.title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {fa(sharedResults.length)} فرد موجود در نظرسنجی
              &nbsp;·&nbsp;
              {fa(sharedScoredCount)} فرد دارای امتیاز
              &nbsp;·&nbsp;
              {fa(votersCount)} پاسخ‌دهنده
            </p>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <button onClick={() => handleExport('pdf')} disabled={!!exporting}
              className="btn-primary text-sm flex items-center gap-1.5 px-3 py-1.5">
              {exporting === 'pdf'
                ? <div className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 12 1.5 1.5 3-3.75m-8.69-6.44A2.25 2.25 0 0 1 8.25 3h6.879a2.25 2.25 0 0 1 1.59.659l4.122 4.122a2.25 2.25 0 0 1 .659 1.591V19.5a2.25 2.25 0 0 1-2.25 2.25h-1.5" />
                  </svg>}
              {'\u06af\u0632\u0627\u0631\u0634 PDF'}
            </button>
            {(['csv', 'excel'] as const).map(type => (
              <button key={type} onClick={() => handleExport(type)} disabled={!!exporting}
                className="btn-secondary text-sm flex items-center gap-1.5 px-3 py-1.5">
                {exporting === type
                  ? <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>}
                {type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 mb-5 overflow-hidden dark:border-slate-700">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-3 sm:px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300 dark:hover:text-slate-200'
            }`}>
            {t.label}
            {t.id === 'people' && (
              <span className="mr-1.5 text-xs bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 rounded-full px-1.5 py-0.5">
                {fa(results.length)}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'ip-audit' ? (
        <IPResponseAudit surveyId={surveyId} />
      ) : scoredCount === 0 ? (
        <div className="card py-20 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-sm text-slate-400 mb-4">هنوز پاسخی برای این نظرسنجی ثبت نشده است.</p>
          <Link to={`/admin/surveys/${id}`} className="btn-secondary text-sm inline-flex items-center gap-1.5 px-4 py-2">
            مشاهده لینک‌های شرکت
          </Link>
        </div>
      ) : (
        <>
          {tab === 'overview'  && <TabOverview  results={sharedResults} survey={survey} />}
          {tab === 'questions' && <TabQuestions results={results} surveyId={surveyId} />}
          {tab === 'people' && (
            <div className="space-y-8">
              {sharedResults.length > 0 && (
                <section><h2 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">افراد با همه سوال‌های عمومی</h2>
                  <TabPeople results={sharedResults} surveyId={surveyId} /></section>
              )}
              {results.filter(r => r.result_section?.startsWith('custom:')).map(r => (
                <section key={r.person_id}><h2 className="mb-3 text-sm font-bold text-amber-700 dark:text-amber-300">بخش اختصاصی: {r.full_name}</h2>
                  <TabPeople results={[r]} surveyId={surveyId} showControls={false} /></section>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-400 text-center mt-8">
            نتایج کاملاً ناشناس هستند — هیچ اطلاعاتی از هویت رأی‌دهندگان نمایش داده نمی‌شود
          </p>
        </>
      )}
    </div>
  );
}
