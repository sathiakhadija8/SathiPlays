export type Subject = {
  id: number;
  name: string;
  color: string;
  icon_key: string;
  cover_image_path: string | null;
};

export type DailyPracticeTarget = {
  id: number;
  item_id: number;
  target_minutes: number;
  is_active: number;
};

export type DailyPracticeStatus = {
  item_id: number | null;
  key_name: string;
  display_name: string;
  icon_type: 'preset' | 'upload';
  preset_icon: string | null;
  uploaded_icon_url: string | null;
  checked_in_today: boolean;
  current_streak_days: number;
  remaining_hours_to_penalty: number;
};

export type RoadmapTask = {
  id: number;
  roadmap_id: number;
  text: string;
  is_done: number;
  done_at: string | null;
  order_index: number;
};

export type Roadmap = {
  id: number;
  title: string;
  tasks: RoadmapTask[];
  completed_count: number;
  total_count: number;
};

export type JobSummary = {
  total_applied: number;
  remote_logs: number;
  in_logs: number;
  total_logs: number;
};

export type StudyStatsWindow = {
  total_minutes: number;
  sessions_count: number;
};

export type StudyStats = {
  last_7_days: StudyStatsWindow;
  last_30_days: StudyStatsWindow;
  this_year: StudyStatsWindow;
};

export type JobApplication = {
  id: number;
  applied_count: number;
  work_mode: 'remote' | 'in';
  update_note: string | null;
  created_at: string;
};

export type CvFile = {
  id: number;
  display_name: string;
  tag: string | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
};

export type Badge = {
  id: number;
  title: string;
  issuer: string | null;
  completed_date: string | null;
  badge_icon_key: string | null;
  badge_color: string | null;
  badge_image_path: string | null;
};

export type CareerSummary = {
  subjects: Subject[];
  today_pomodoro_total_minutes: number;
  daily_practice_statuses: DailyPracticeStatus[];
  roadmaps: Roadmap[];
  study_stats: StudyStats;
};
