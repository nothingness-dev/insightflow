export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'employee';
  is_active: boolean;
  created_at: string;
}

export interface Survey {
  id: number;
  title: string;
  question: string;
  description: string;
  status: 'draft' | 'published' | 'closed';
  results_visibility: 'admin_only';
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
  comments: string[];
}

export interface SurveyResults {
  survey: {
    id: number;
    title: string;
    question: string;
    status: string;
  };
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
  is_complete: boolean;
}
