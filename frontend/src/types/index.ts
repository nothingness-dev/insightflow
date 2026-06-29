export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'employee';
  is_active: boolean;
  must_change_password?: boolean;
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
  has_emoji: boolean;
  emoji_required: boolean;
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
  has_emoji: boolean;
  emoji_required: boolean;
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

  anonymous_participants_count?: number;
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

export type EmojiRatingValue = 'bad' | 'average' | 'good' | 'excellent';

export interface QuestionResult {
  question_id: number;
  question_text: string;
  has_score: boolean;
  score_required: boolean;
  has_comment: boolean;
  comment_required: boolean;
  has_emoji: boolean;
  emoji_required: boolean;
  average_score: number | null;
  total_score: number;
  responses_count: number;
  votes_count: number;
  comments: string[];
  comments_count?: number;
  average_emoji_numeric?: number | null;
  average_emoji_label?: string | null;
  emoji_responses_count?: number;
  emoji_votes_count?: number;
  emoji_breakdown?: Record<EmojiRatingValue, number>;
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
  comments_count?: number;
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
  ip_locked?: boolean;
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
  anonymous_participants: number;
  pending_employees: number;
  completion_percentage: number;
  pending_users: PendingSurveyEmployee[];
}

export interface SurveyProgressDashboard {
  summary: {
    total_surveys: number;
    total_assigned_responses: number;
    total_completed_responses: number;
    total_anonymous_participants: number;
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


export interface ActivityLog {
  id: number;
  action: string;
  action_label: string;
  actor: number | null;
  actor_username: string;
  actor_full_name: string;
  actor_role: string;
  actor_display: string;
  description: string;
  target_type: string;
  target_id: string;
  target_repr: string;
  status: 'success' | 'failed';
  is_critical: boolean;
  ip_address: string | null;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityStats {
  total_activities: number;
  today_activities: number;
  week_activities: number;
  critical_activities: number;
  failed_activities: number;
  most_active_admin: {
    actor_id: number;
    username: string;
    full_name: string;
    count: number;
  } | null;
}

export interface ActivityFilterOptions {
  actions: { value: string; label: string; critical: boolean }[];
  actors: { id: number; username: string; full_name: string }[];
  statuses: { value: string; label: string }[];
}

export interface ActivityCharts {
  days: number;
  daily: { date: string; total: number; failed: number }[];
  by_action: { action: string; label: string; count: number }[];
}

export interface ActivityCriticalPanel {
  count: number;
  items: ActivityLog[];
}

export interface ActivityLogFilters {
  search?: string;
  action?: string;
  status?: string;
  actor?: string;
  is_critical?: string;
  date_from?: string;
  date_to?: string;
  page?: string;
  page_size?: string;
}

export interface SurveyHashLink {
  id: number;
  survey: number;
  token: string;
  label: string;
  is_active: boolean;
  anonymous_participant_count: number;
  created_at: string;
}
