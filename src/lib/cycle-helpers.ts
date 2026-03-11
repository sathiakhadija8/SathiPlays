export type CycleDaySummary = {
  day: string;
  has_logs: boolean;
  has_symptoms: boolean;
  has_period: boolean;
  has_bc: boolean;
};

export type CycleLogItem = {
  id: number;
  created_at: string;
  symptoms: string[];
  bleeding_type: 'none' | 'spotting' | 'period';
  birth_control_taken: boolean;
  note: string | null;
};

export function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function lastNDates(days: number): string[] {
  const output: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    output.push(toYMD(date));
  }
  return output;
}

export function formatHHMM(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function dotState(day: CycleDaySummary): 'period' | 'bc' | 'symptoms' | 'none' {
  if (day.has_period) return 'period';
  if (day.has_bc) return 'bc';
  if (day.has_symptoms) return 'symptoms';
  return 'none';
}

export function parseSymptoms(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
}
