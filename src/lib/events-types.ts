export const EVENT_CATEGORIES = ['Career', 'Glow', 'Home', 'Food', 'Vinted', 'Content'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export type EventItem = {
  id: number;
  title: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes?: string | null;
  category: string | null;
};

export type MonthCountItem = {
  date: string;
  count: number;
};
