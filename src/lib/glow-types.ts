export type GlowRoutineTask = {
  id: number;
  routine_id: number;
  title: string;
  order_index: number;
};

export type GlowRoutine = {
  id: number;
  name: string;
  type: string;
  active_days: string[];
  current_streak: number;
  last_completed_date: string | null;
  completed_today?: boolean;
  polaroid_uploaded_today?: boolean;
  tasks: GlowRoutineTask[];
};

export type GlowBook = {
  id: number;
  title: string;
  icon_path: string;
  image_count?: number;
};

export type GlowImage = {
  id: number;
  routine_id: number;
  routine_name?: string;
  book_id: number;
  image_path: string;
  caption: string | null;
  quote: string | null;
  created_at: string;
  book_title?: string | null;
};

export type GlowSummary = {
  today_weekday: string;
  today_routines: GlowRoutine[];
  books: GlowBook[];
  recent_images: GlowImage[];
};
