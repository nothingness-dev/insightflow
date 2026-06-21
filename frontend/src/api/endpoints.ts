import api from './client';
import { ActivityCharts, ActivityCriticalPanel, ActivityFilterOptions, ActivityLog, ActivityLogFilters, ActivityStats, BulkImportResult, DashboardStats, MyRatings, PaginatedResponse, Survey, SurveyPerson, SurveyProgressDashboard, SurveyQuestionInput, SurveyResults, User } from '../types';

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login/', { username, password }),
  logout: (refresh: string) =>
    api.post('/auth/logout/', { refresh }),
  me: () => api.get<User>('/auth/me/'),
  changePassword: (data: { current_password: string; new_password: string; new_password_confirm: string }) =>
    api.post('/auth/change-password/', data),
};

// Admin Surveys
export const adminSurveyApi = {
  list: (params?: Record<string, string>) =>
    api.get<Survey[]>('/admin/surveys/', { params }),
  create: (data: { title: string; description: string; results_visibility: 'admin_only'; questions: SurveyQuestionInput[] }) =>
    api.post<Survey>('/admin/surveys/', data),
  get: (id: number) =>
    api.get<Survey>(`/admin/surveys/${id}/`),
  update: (id: number, data: { title: string; description: string; results_visibility: 'admin_only'; questions: SurveyQuestionInput[] }) =>
    api.patch<Survey>(`/admin/surveys/${id}/`, data),
  delete: (id: number) =>
    api.delete(`/admin/surveys/${id}/`),
  duplicate: (id: number) =>
    api.post<Survey>(`/admin/surveys/${id}/duplicate/`),
  publish: (id: number) =>
    api.post<Survey>(`/admin/surveys/${id}/publish/`),
  close: (id: number) =>
    api.post<Survey>(`/admin/surveys/${id}/close/`),
  results: (id: number) =>
    api.get<SurveyResults>(`/admin/surveys/${id}/results/`),
  comments: (id: number, params: { person_id?: number; question_id?: number; page?: number; page_size?: number }) =>
    api.get<{ total: number; page: number; page_size: number; total_pages: number; comments: { comment: string; question_text: string }[] }>(`/admin/surveys/${id}/comments/`, { params }),
  exportCsv: (id: number) =>
    api.get(`/admin/surveys/${id}/export/csv/`, { responseType: 'blob' }),
  exportExcel: (id: number) =>
    api.get(`/admin/surveys/${id}/export/excel/`, { responseType: 'blob' }),
  exportPdf: (id: number) =>
    api.get(`/admin/surveys/${id}/export/pdf/`, { responseType: 'blob' }),
};

// Admin People
export const adminPersonApi = {
  list: (surveyId: number) =>
    api.get<SurveyPerson[]>(`/admin/surveys/${surveyId}/people/`),
  create: (surveyId: number, data: FormData) =>
    api.post<SurveyPerson>(`/admin/surveys/${surveyId}/people/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: number, data: FormData | Partial<SurveyPerson>) =>
    api.patch<SurveyPerson>(`/admin/people/${id}/`, data,
      data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
    ),
  delete: (id: number) =>
    api.delete(`/admin/people/${id}/`),
};

// Admin Users
export const adminUserApi = {
  list: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<User>>('/admin/users/', { params }),
  create: (data: Partial<User> & { password: string; password_confirm: string }) =>
    api.post<User>('/admin/users/', data),
  get: (id: number) =>
    api.get<User>(`/admin/users/${id}/`),
  update: (id: number, data: Partial<User>) =>
    api.patch<User>(`/admin/users/${id}/`, data),
  resetPassword: (id: number, newPassword: string) =>
    api.post(`/admin/users/${id}/reset-password/`, {
      new_password: newPassword,
      new_password_confirm: newPassword,
    }),
  activate: (id: number) =>
    api.post(`/admin/users/${id}/activate/`),
  deactivate: (id: number) =>
    api.post(`/admin/users/${id}/deactivate/`),
  delete: (id: number) =>
    api.delete(`/admin/users/${id}/`),
  bulkImport: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<BulkImportResult>('/admin/users/bulk-import/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Admin Dashboard
export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/admin/dashboard/'),
  surveyProgress: () => api.get<SurveyProgressDashboard>('/admin/surveys/progress/'),
  deleteAllData: () =>
    api.delete('/admin/delete-all-data/', { data: { confirm: 'DELETE_ALL' } }),
};

// Activity Center / Audit Reports
export const activityApi = {
  logs: (params?: ActivityLogFilters) =>
    api.get<PaginatedResponse<ActivityLog>>('/admin/activity/logs/', { params }),
  stats: () => api.get<ActivityStats>('/admin/activity/stats/'),
  timeline: (limit = 15) =>
    api.get<ActivityLog[]>('/admin/activity/timeline/', { params: { limit: String(limit) } }),
  critical: (limit = 10) =>
    api.get<ActivityCriticalPanel>('/admin/activity/critical/', { params: { limit: String(limit) } }),
  charts: (days = 14) =>
    api.get<ActivityCharts>('/admin/activity/charts/', { params: { days: String(days) } }),
  filterOptions: () => api.get<ActivityFilterOptions>('/admin/activity/filters/'),
  export: (exportFormat: 'csv' | 'excel' | 'pdf', dateFrom: string, dateTo: string, extra?: ActivityLogFilters) =>
    api.get(`/admin/activity/export/`, {
      params: { export_format: exportFormat, date_from: dateFrom, date_to: dateTo, ...extra },
      responseType: 'blob',
    }),
};

// Employee
export const employeeApi = {
  surveys: () =>
    api.get<Survey[]>('/surveys/'),
  survey: (id: number) =>
    api.get(`/surveys/${id}/`),
  rate: (surveyId: number, personId: number, answers: { question_id: number; score?: number | null; comment?: string | null }[]) =>
    api.post(`/surveys/${surveyId}/people/${personId}/rate/`, { answers }),
  myRatings: (surveyId: number) =>
    api.get<MyRatings>(`/surveys/${surveyId}/my-ratings/`),
  results: (surveyId: number) =>
    api.get<SurveyResults>(`/surveys/${surveyId}/results/`),
};
