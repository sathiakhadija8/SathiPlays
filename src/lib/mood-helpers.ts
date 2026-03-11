export type MoodMode = 'today' | '7d' | '30d';

export type TodayPoint = {
  mood_value: number;
  created_at: string;
};

export type DailyPoint = {
  day: string;
  avg_value: number;
};

export type MoodRangeResponse = {
  mode: MoodMode;
  points: TodayPoint[] | DailyPoint[];
  today_avg: number | null;
  today_min: number | null;
  today_max: number | null;
  today_count: number;
};

export function formatHHMM(dateValue: string | Date): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function isTodayPoints(points: MoodRangeResponse['points']): points is TodayPoint[] {
  if (!points.length) return true;
  return 'created_at' in points[0];
}
