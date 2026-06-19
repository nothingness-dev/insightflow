import api from './client';
import { Survey, SurveyPerson, User, DashboardStats, SurveyResults, MyRatings } from '../types';

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login/', { username, password }),
  logout: (refresh: string) =>
    api.post('/auth/logout/', { refresh }),
  me: () => api.get<User>('/auth/me/'),
};

// Admin Surveys
export const adminSurveyApi = {
  list: (params?: Record<string, string>) =>
    api.get<Survey[]>('/admin/surveys/', { params }),
  create: (data: Partial<Survey>) =>
    api.post<Survey>('/admin/surveys/', data),
  get: (id: number) =>
    api.get<Survey>(`/admin/surveys/${id}/`),
  update: (id: number, data: Partial<Survey>) =>
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
  exportCsv: (id: number) =>
    api.get(`/admin/surveys/${id}/export/csv/`, { responseType: 'blob' }),
  exportExcel: (id: number) =>
    api.get(`/admin/surveys/${id}/export/excel/`, { responseType: 'blob' }),
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
    api.get<User[]>('/admin/users/', { params }),
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
    return api.post('/admin/users/bulk-import/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// Admin Dashboard
export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/admin/dashboard/'),
  deleteAllData: () =>
    api.delete('/admin/delete-all-data/', { data: { confirm: 'DELETE_ALL' } }),
};

// Employee
export const employeeApi = {
  surveys: () =>
    api.get<Survey[]>('/surveys/'),
  survey: (id: number) =>
    api.get(`/surveys/${id}/`),
  rate: (surveyId: number, personId: number, score: number, comment?: string) =>
    api.post(`/surveys/${surveyId}/people/${personId}/rate/`, { score, comment: comment || undefined }),
  myRatings: (surveyId: number) =>
    api.get<MyRatings>(`/surveys/${surveyId}/my-ratings/`),
  results: (surveyId: number) =>
    api.get<SurveyResults>(`/surveys/${surveyId}/results/`),
};
