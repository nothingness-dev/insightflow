import api from './client';
import { ActivityCharts, ActivityCriticalPanel, ActivityFilterOptions, ActivityLog, ActivityLogFilters, ActivityStats, BulkImportResult, DashboardStats, EmojiRatingValue, MyRatings, PaginatedResponse, Survey, SurveyPerson, SurveyProgressDashboard, SurveyQuestionInput, SurveyResults, User } from '../types';

type SurveyPayload = {
  title: string;
  description: string;
  results_visibility: 'admin_only';
  questions?: SurveyQuestionInput[];
};


export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login/', { username, password }),
  logout: (refresh: string) =>
    api.post('/auth/logout/', { refresh }),
  me: () => api.get<User>('/auth/me/'),
  changePassword: (data: { current_password: string; new_password: string; new_password_confirm: string }) =>
    api.post('/auth/change-password/', data),
};


export const adminSurveyApi = {
  list: (params?: Record<string, string>, signal?: AbortSignal) =>
    api.get<Survey[]>('/admin/surveys/', { params, signal }),
  create: (data: SurveyPayload) =>
    api.post<Survey>('/admin/surveys/', data),
  get: (id: number, signal?: AbortSignal) =>
    api.get<Survey>(`/admin/surveys/${id}/`, { signal }),
  update: (id: number, data: SurveyPayload) =>
    api.patch<Survey>(`/admin/surveys/${id}/`, data),
  delete: (id: number) =>
    api.delete(`/admin/surveys/${id}/`),
  duplicate: (id: number) =>
    api.post<Survey>(`/admin/surveys/${id}/duplicate/`),
  publish: (id: number) =>
    api.post<Survey>(`/admin/surveys/${id}/publish/`),
  close: (id: number) =>
    api.post<Survey>(`/admin/surveys/${id}/close/`),
  results: (id: number, signal?: AbortSignal) =>
    api.get<SurveyResults>(`/admin/surveys/${id}/results/`, { signal }),
  comments: (id: number, params: { person_id?: number; question_id?: number; page?: number; page_size?: number }, signal?: AbortSignal) =>
    api.get<{ total: number; page: number; page_size: number; total_pages: number; comments: { comment: string; question_text: string }[] }>(`/admin/surveys/${id}/comments/`, { params, signal }),
  exportCsv: (id: number) =>
    api.get(`/admin/surveys/${id}/export/csv/`, { responseType: 'blob' }),
  exportExcel: (id: number) =>
    api.get(`/admin/surveys/${id}/export/excel/`, { responseType: 'blob' }),
  exportPdf: (id: number) =>
    api.get(`/admin/surveys/${id}/export/pdf/`, { responseType: 'blob' }),
};


export const adminPersonApi = {
  list: (surveyId: number, signal?: AbortSignal) =>
    api.get<SurveyPerson[]>(`/admin/surveys/${surveyId}/people/`, { signal }),
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


export const adminUserApi = {
  list: (params?: Record<string, string>, signal?: AbortSignal) =>
    api.get<PaginatedResponse<User>>('/admin/users/', { params, signal }),
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


export const dashboardApi = {
  stats: (signal?: AbortSignal) => api.get<DashboardStats>('/admin/dashboard/', { signal }),
  surveyProgress: (signal?: AbortSignal) => api.get<SurveyProgressDashboard>('/admin/surveys/progress/', { signal }),
  deleteAllData: () =>
    api.delete('/admin/delete-all-data/', { data: { confirm: 'DELETE_ALL' } }),
};


export const activityApi = {
  logs: (params?: ActivityLogFilters, signal?: AbortSignal) =>
    api.get<PaginatedResponse<ActivityLog>>('/admin/activity/logs/', { params, signal }),
  stats: (signal?: AbortSignal) => api.get<ActivityStats>('/admin/activity/stats/', { signal }),
  timeline: (limit = 15, signal?: AbortSignal) =>
    api.get<ActivityLog[]>('/admin/activity/timeline/', { params: { limit: String(limit) }, signal }),
  critical: (limit = 10, signal?: AbortSignal) =>
    api.get<ActivityCriticalPanel>('/admin/activity/critical/', { params: { limit: String(limit) }, signal }),
  charts: (days = 14, signal?: AbortSignal) =>
    api.get<ActivityCharts>('/admin/activity/charts/', { params: { days: String(days) }, signal }),
  filterOptions: (signal?: AbortSignal) => api.get<ActivityFilterOptions>('/admin/activity/filters/', { signal }),
  export: (exportFormat: 'csv' | 'excel' | 'pdf', dateFrom: string, dateTo: string, extra?: ActivityLogFilters) =>
    api.get(`/admin/activity/export/`, {
      params: { export_format: exportFormat, date_from: dateFrom, date_to: dateTo, ...extra },
      responseType: 'blob',
    }),
};


export const employeeApi = {
  surveys: (signal?: AbortSignal) =>
    api.get<Survey[]>('/surveys/', { signal }),
  survey: (id: number, signal?: AbortSignal) =>
    api.get(`/surveys/${id}/`, { signal }),
  rate: (surveyId: number, personId: number, answers: { question_id: number; score?: number | null; emoji_rating?: EmojiRatingValue | null; comment?: string | null }[]) =>
    api.post(`/surveys/${surveyId}/people/${personId}/rate/`, { answers }),
  myRatings: (surveyId: number) =>
    api.get<MyRatings>(`/surveys/${surveyId}/my-ratings/`),
  results: (surveyId: number) =>
    api.get<SurveyResults>(`/surveys/${surveyId}/results/`),
};


export const adminHashLinkApi = {
  list: (surveyId: number, signal?: AbortSignal) =>
    api.get<import('../types').SurveyHashLink[]>(`/admin/surveys/${surveyId}/hash-links/`, { signal }),
  create: (surveyId: number, label?: string) =>
    api.post<import('../types').SurveyHashLink>(`/admin/surveys/${surveyId}/hash-links/`, { label: label || '' }),
  update: (id: number, data: { label?: string; is_active?: boolean }) =>
    api.patch<import('../types').SurveyHashLink>(`/admin/hash-links/${id}/`, data),
  delete: (id: number) =>
    api.delete(`/admin/hash-links/${id}/`),
};


export const anonymousApi = {
  survey: (token: string) =>
    api.get(`/s/${token}/`),
  rate: (
    token: string,
    personId: number,
    answers: { question_id: number; score?: number | null; emoji_rating?: EmojiRatingValue | null; comment?: string | null }[],
    anonymousToken: string,
  ) =>
    api.post(`/s/${token}/people/${personId}/rate/`, { answers, anonymous_token: anonymousToken }),
  myRatings: (token: string, surveyId: number, anonymousToken: string) =>
    api.get<import('../types').MyRatings>(`/s/${token}/surveys/${surveyId}/my-ratings/`, {
      params: { anonymous_token: anonymousToken },
    }),
};
