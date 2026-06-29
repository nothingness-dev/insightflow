import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { AdminRoute, EmployeeRoute, GuestRoute } from './routes/Guards';
import AdminLayout from './layouts/AdminLayout';
import EmployeeLayout from './layouts/EmployeeLayout';


const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminSurveyList = lazy(() => import('./pages/admin/SurveyList'));
const SurveyForm = lazy(() => import('./pages/admin/SurveyForm'));
const SurveyDetail = lazy(() => import('./pages/admin/SurveyDetail'));
const SurveyResults = lazy(() => import('./pages/admin/SurveyResults'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const SurveyProgressPage = lazy(() => import('./pages/admin/SurveyProgress'));
const ActivityCenter = lazy(() => import('./pages/admin/ActivityCenter'));
const EmployeeSurveyList = lazy(() => import('./pages/employee/SurveyList'));
const EmployeeSurveyDetail = lazy(() => import('./pages/employee/SurveyDetail'));
const AnonymousSurvey = lazy(() => import('./pages/AnonymousSurvey'));

function PageFallback() {
  return <div className="min-h-screen bg-slate-50" />;
}

function AdminWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AdminRoute>
      <AdminLayout>{children}</AdminLayout>
    </AdminRoute>
  );
}

function EmployeeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <EmployeeRoute>
      <EmployeeLayout>{children}</EmployeeLayout>
    </EmployeeRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
<Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
<Route path="/admin" element={<AdminWrapper><AdminDashboard /></AdminWrapper>} />
          <Route path="/admin/surveys" element={<AdminWrapper><AdminSurveyList /></AdminWrapper>} />
          <Route path="/admin/survey-progress" element={<AdminWrapper><SurveyProgressPage /></AdminWrapper>} />
          <Route path="/admin/surveys/new" element={<AdminWrapper><SurveyForm /></AdminWrapper>} />
          <Route path="/admin/surveys/:id" element={<AdminWrapper><SurveyDetail /></AdminWrapper>} />
          <Route path="/admin/surveys/:id/edit" element={<AdminWrapper><SurveyForm /></AdminWrapper>} />
          <Route path="/admin/surveys/:id/results" element={<AdminWrapper><SurveyResults /></AdminWrapper>} />
          <Route path="/admin/users" element={<AdminWrapper><UserManagement /></AdminWrapper>} />
          <Route path="/admin/activity" element={<AdminWrapper><ActivityCenter /></AdminWrapper>} />
<Route path="/surveys" element={<EmployeeWrapper><EmployeeSurveyList /></EmployeeWrapper>} />
          <Route path="/surveys/:id" element={<EmployeeWrapper><EmployeeSurveyDetail /></EmployeeWrapper>} />
<Route path="/s/:token" element={<AnonymousSurvey />} />
<Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: 'Vazirmatn, sans-serif',
            fontSize: '14px',
            direction: 'rtl',
            borderRadius: '10px',
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
    </AuthProvider>
  );
}
