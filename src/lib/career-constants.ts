export const CAREER_DOMAIN = 'career' as const;

export const CAREER_CATEGORIES = ['Career', 'Glow', 'Home', 'Food', 'Vinted', 'Content'] as const;

export const POMODORO_LABELS = ['Deep Work', 'Revision', 'Practice', 'Mock Interview', 'Portfolio'] as const;

export const INACTIVITY_GUARDS = {
  pomodoro: 'pomodoro_24h',
} as const;

export const DAILY_PRACTICE_PRESET_ICONS = ['🗣', '🚗', '🧠', '📚', '💼', '💻', '🧪', '📝', '🎯', '🚀', '📊', '🎤'] as const;
export const DAILY_PRACTICE_DEFAULT_ICON = '📝';

export function dailyPracticeGuardKey(itemId: number | string) {
  if (typeof itemId === 'number') return `daily_practice_item_${itemId}_24h`;
  return `daily_practice_${itemId}_24h`;
}

export const SUBJECT_COLORS = ['#3F5BFF', '#FF3EA5', '#C084FC', '#6FA8FF', '#FF79C6', '#9D8CFF'] as const;

export const SUBJECT_ICONS = ['📘', '🧠', '💼', '🧪', '📊', '🎯', '📝', '🚀'] as const;
