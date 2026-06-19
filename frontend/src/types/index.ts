export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'employee';
  is_active: boolean;
  created_at: string;
}

export interface SurveyQuestion {
  id: number;
  survey?: number;
  text: string;
  help_text: string;
  has_score: boolean;
  score_required: boolean;
  has_comment: boolean;
  comment_required: boolean;
  display_order: number;
  is_active?: boolean;
  created_at?: string;
}

export interface SurveyQuestionInput {
  id?: number;
  text: string;
  help_text: string;
  has_score: boolean;
  score_required: boolean;
  has_comment: boolean;
  comment_required: boolean;
  display_order: number;
  is_active?: boolean;
}

export interface Survey {
  id: number;
  title: string;
  question: string;
  description: string;
  status: 'draft' | 'published' | 'closed';
  results_visibility: 'admin_only';
  questions: SurveyQuestion[];
  questions_count: number;
  created_by: number | null;
  created_by_name: string | null;
  people_count: number;
  total_responses: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closed_at: string | null;
  // employee fields
  my_votes_count?: number;
  total_people?: number;
  total_questions?: number;
  is_active?: boolean;
}

export interface SurveyPerson {
  id: number;
  survey?: number;
  full_name: string;
  photo_url: string | null;
  role_title: string;
  department: string;
  description: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  has_rated?: boolean;
}

export interface QuestionResult {
  question_id: number;
  question_text: string;
  has_score: boolean;
  score_required: boolean;
  has_comment: boolean;
  comment_required: boolean;
  average_score: number | null;
  total_score: number;
  responses_count: number;
  votes_count: number;
  comments: string[];
}

export interface ResultComment {
  question_id: number;
  question_text: string;
  comment: string;
}

export interface PersonResult {
  rank: number;
  person_id: number;
  full_name: string;
  photo_url: string | null;
  department: string;
  role_title: string;
  average_score: number | null;
  total_score: number;
  votes_count: number;
  scored_answers_count?: number;
  comments: ResultComment[];
  question_results: QuestionResult[];
}

export interface SurveyResults {
  survey: Survey;
  results: PersonResult[];
}

export interface DashboardStats {
  stats: {
    total_surveys: number;
    draft_surveys: number;
    published_surveys: number;
    closed_surveys: number;
    total_responses: number;
    total_employees: number;
  };
  recent_surveys: Survey[];
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface MyRatings {
  survey_id: number;
  rated_person_ids: number[];
  rated_count: number;
  total_people: number;
  total_questions: number;
  required_answers_count: number;
  is_complete: boolean;
}

export interface PendingSurveyEmployee {
  id: number;
  username: string;
  full_name: string;
}

export interface SurveyProgress {
  survey_id: number;
  title: string;
  status: Survey['status'];
  active_people_count: number;
  active_questions_count: number;
  tracking_enabled: boolean;
  assigned_employees: number;
  completed_employees: number;
  pending_employees: number;
  completion_percentage: number;
  pending_users: PendingSurveyEmployee[];
}

export interface SurveyProgressDashboard {
  summary: {
    total_surveys: number;
    total_assigned_responses: number;
    total_completed_responses: number;
    total_pending_responses: number;
    overall_completion_percentage: number;
  };
  surveys: SurveyProgress[];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface BulkImportResult {
  created_count: number;
  skipped_count: number;
  error_count: number;
  created: { username: string; full_name: string; role: string }[];
  skipped: { line: number; username: string; reason: string }[];
  errors: { line: number; error: string }[];
  details_truncated: boolean;
  created_details_omitted: number;
  skipped_details_omitted: number;
  error_details_omitted: number;
}
