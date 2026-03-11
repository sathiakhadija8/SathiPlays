export type LevelBand = {
  number: number;
  label: string;
  min: number;
  max: number | null;
};

export const LEVEL_THRESHOLDS: LevelBand[] = [
  { number: 1, label: 'Reset', min: 0, max: 199 },
  { number: 2, label: 'Emerging', min: 200, max: 499 },
  { number: 3, label: 'Structured', min: 500, max: 999 },
  { number: 4, label: 'Momentum', min: 1000, max: 1799 },
  { number: 5, label: 'Magnetic', min: 1800, max: 2999 },
  { number: 6, label: 'Elite', min: 3000, max: 4499 },
  { number: 7, label: 'Soft Power', min: 4500, max: null },
];

export type ComputedLevel = {
  total_points: number;
  level: { number: number; label: string; min_points: number; max_points: number | null };
  progress_ratio: number;
  points_to_next_level: number;
};

export function computeLevel(totalPoints: number): ComputedLevel {
  const safePoints = Number.isFinite(totalPoints) ? Math.max(0, Math.floor(totalPoints)) : 0;

  let current = LEVEL_THRESHOLDS[0];
  for (const band of LEVEL_THRESHOLDS) {
    const within = band.max == null ? safePoints >= band.min : safePoints >= band.min && safePoints <= band.max;
    if (within) {
      current = band;
      break;
    }
  }

  const nextBand = LEVEL_THRESHOLDS.find((band) => band.min > current.min);
  const pointsToNext = nextBand ? Math.max(0, nextBand.min - safePoints) : 0;

  let ratio = 1;
  if (current.max != null) {
    const span = Math.max(1, current.max - current.min + 1);
    ratio = Math.min(1, Math.max(0, (safePoints - current.min) / span));
  }

  return {
    total_points: safePoints,
    level: {
      number: current.number,
      label: current.label,
      min_points: current.min,
      max_points: current.max,
    },
    progress_ratio: ratio,
    points_to_next_level: pointsToNext,
  };
}
