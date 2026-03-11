export const CYCLE_SYMPTOM_GROUPS = {
  'Mood/Mind': ['Low mood', 'Irritable', 'Anxious', 'Brain fog', 'Calm', 'Focused'],
  Body: ['Bloating', 'Cramps', 'Headache', 'Fatigue', 'Back pain', 'Breast tenderness'],
  'Skin/Hair': ['Acne flare', 'Oily skin', 'Hair shedding'],
  'Cravings/Energy': ['Sweet cravings', 'Hunger spikes', 'Energy crash', 'High energy'],
} as const;

export const CYCLE_SYMPTOMS = Object.values(CYCLE_SYMPTOM_GROUPS).flat();

export const CYCLE_SYMPTOM_SET = new Set<string>(CYCLE_SYMPTOMS);

export const BLEEDING_TYPES = ['none', 'spotting', 'period'] as const;
export type BleedingType = (typeof BLEEDING_TYPES)[number];
