import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { AdminRoute, EmployeeRoute, GuestRoute } from './routes/Guards';
import AdminLayout from './layouts/AdminLayout';
import EmployeeLayout from './layouts/EmployeeLayout';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/Dashboard';
import AdminSurveyList from './pages/admin/SurveyList';
import SurveyForm from './pages/admin/SurveyForm';
import SurveyDetail from './pages/admin/SurveyDetail';
import SurveyResults from './pages/admin/SurveyResults';
import UserManagement from './pages/admin/UserManagement';
import SurveyProgressPage from './pages/admin/SurveyProgress';
import EmployeeSurveyList from './pages/employee/SurveyList';
import EmployeeSurveyDetail from './pages/employee/SurveyDetail';

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
        <Routes>
          {/* Public */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<AdminWrapper><AdminDashboard /></AdminWrapper>} />
          <Route path="/admin/surveys" element={<AdminWrapper><AdminSurveyList /></AdminWrapper>} />
          <Route path="/admin/survey-progress" element={<AdminWrapper><SurveyProgressPage /></AdminWrapper>} />
          <Route path="/admin/surveys/new" element={<AdminWrapper><SurveyForm /></AdminWrapper>} />
          <Route path="/admin/surveys/:id" element={<AdminWrapper><SurveyDetail /></AdminWrapper>} />
          <Route path="/admin/surveys/:id/edit" element={<AdminWrapper><SurveyForm /></AdminWrapper>} />
          <Route path="/admin/surveys/:id/results" element={<AdminWrapper><SurveyResults /></AdminWrapper>} />
          <Route path="/admin/users" element={<AdminWrapper><UserManagement /></AdminWrapper>} />

          {/* Employee */}
          <Route path="/surveys" element={<EmployeeWrapper><EmployeeSurveyList /></EmployeeWrapper>} />
          <Route path="/surveys/:id" element={<EmployeeWrapper><EmployeeSurveyDetail /></EmployeeWrapper>} />

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
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
