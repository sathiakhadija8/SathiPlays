'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { TeaCheckInModal } from './TeaCheckInModal';

type GymWorkoutType = 'glutes' | 'legs' | 'upper' | 'cardio' | 'rest' | 'custom';
type GymIntensity = 'low' | 'medium' | 'high';
type GymPlanDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

type TodayPayload = {
  date: string;
  water_ml: number;
  water_cups: number;
  steps_total: number;
  tea_count_today: number;
  gym_today: {
    id: number;
    date: string;
    workout_type: GymWorkoutType;
    duration_minutes: number;
    intensity: GymIntensity;
    notes: string | null;
    created_at: string;
  } | null;
  gym_planned: {
    day_of_week: GymPlanDay;
    workout_type: GymWorkoutType;
    is_active: number;
  } | null;
};

type WeeklyPayload = {
  week_of: string;
  today_day: GymPlanDay;
  plans: Array<{
    id: number | null;
    day_of_week: GymPlanDay;
    workout_type: GymWorkoutType;
    is_active: number;
    completed_this_week: boolean;
  }>;
};

const DAY_LABELS: Record<GymPlanDay, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const WORKOUT_OPTIONS: GymWorkoutType[] = ['glutes', 'legs', 'upper', 'cardio', 'rest', 'custom'];
const INTENSITY_OPTIONS: GymIntensity[] = ['low', 'medium', 'high'];

function titleWorkout(value: GymWorkoutType) {
  if (value === 'upper') return 'Upper';
  if (value === 'cardio') return 'Cardio';
  if (value === 'rest') return 'Rest';
  if (value === 'custom') return 'Custom';
  if (value === 'legs') return 'Legs';
  return 'Glutes';
}

function todayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function GymLogModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [date, setDate] = useState(todayDateInputValue());
  const [workoutType, setWorkoutType] = useState<GymWorkoutType>('glutes');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [intensity, setIntensity] = useState<GymIntensity>('medium');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(todayDateInputValue());
    setWorkoutType('glutes');
    setDurationMinutes('45');
    setIntensity('medium');
    setNotes('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <form
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[rgba(10,14,30,0.86)] p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const duration = Number(durationMinutes);
          if (!Number.isFinite(duration) || duration <= 0) return;
          setSaving(true);
          const response = await fetch('/api/glow/action-row/gym', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date,
              workout_type: workoutType,
              duration_minutes: duration,
              intensity,
              notes: notes.trim() || null,
            }),
          });
          setSaving(false);
          if (!response.ok) return;
          await onSaved();
          onClose();
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-serif text-2xl text-white">Log Gym</p>
          <button type="button" onClick={onClose} className="rounded-full border border-white/40 bg-transparent px-3 py-1 text-xs text-white">Close</button>
        </div>

        <div className="space-y-2">
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="h-9 w-full rounded-lg border border-white/20 bg-black/20 px-3 text-sm text-white" />
          <select value={workoutType} onChange={(e) => setWorkoutType(e.target.value as GymWorkoutType)} className="h-9 w-full rounded-lg border border-white/20 bg-black/20 px-3 text-sm text-white">
            {WORKOUT_OPTIONS.map((option) => (
              <option key={option} value={option}>{titleWorkout(option)}</option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="Duration minutes"
            className="h-9 w-full rounded-lg border border-white/20 bg-black/20 px-3 text-sm text-white"
          />
          <select value={intensity} onChange={(e) => setIntensity(e.target.value as GymIntensity)} className="h-9 w-full rounded-lg border border-white/20 bg-black/20 px-3 text-sm text-white">
            {INTENSITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>
            ))}
          </select>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)" className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white" />
        </div>

        <div className="mt-3 flex justify-end">
          <button type="submit" disabled={saving} className="rounded-full border border-white/50 bg-transparent px-4 py-1.5 text-xs text-white hover:shadow-[0_0_14px_rgba(114,211,255,0.45)]">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

function GymWeeklyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [payload, setPayload] = useState<WeeklyPayload | null>(null);
  const [draft, setDraft] = useState<Record<GymPlanDay, { workout_type: GymWorkoutType; is_active: number }>>({
    mon: { workout_type: 'glutes', is_active: 1 },
    tue: { workout_type: 'upper', is_active: 1 },
    wed: { workout_type: 'legs', is_active: 1 },
    thu: { workout_type: 'cardio', is_active: 1 },
    fri: { workout_type: 'glutes', is_active: 1 },
    sat: { workout_type: 'rest', is_active: 1 },
    sun: { workout_type: 'rest', is_active: 1 },
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const response = await fetch('/api/glow/action-row/gym/weekly-plan', { cache: 'no-store' });
    if (!response.ok) return;
    const next = (await response.json()) as WeeklyPayload;
    setPayload(next);
    const nextDraft = { ...draft };
    for (const plan of next.plans) {
      nextDraft[plan.day_of_week] = { workout_type: plan.workout_type, is_active: plan.is_active };
    }
    setDraft(nextDraft);
  };

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[rgba(10,14,30,0.86)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-serif text-2xl text-white">Weekly Gym Plan</p>
          <button type="button" onClick={onClose} className="rounded-full border border-white/40 bg-transparent px-3 py-1 text-xs text-white">Close</button>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {(payload?.plans ?? []).map((plan) => (
            <div
              key={plan.day_of_week}
              className={`rounded-xl border p-2 ${
                payload?.today_day === plan.day_of_week ? 'border-[#72d3ff99] bg-[#72d3ff1a]' : 'border-white/20 bg-black/20'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs text-white">{DAY_LABELS[plan.day_of_week]}</p>
                {plan.completed_this_week ? <span className="text-xs text-white">✔</span> : null}
              </div>
              <select
                value={draft[plan.day_of_week]?.workout_type ?? 'rest'}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    [plan.day_of_week]: {
                      ...prev[plan.day_of_week],
                      workout_type: e.target.value as GymWorkoutType,
                    },
                  }))
                }
                className="h-8 w-full rounded-lg border border-white/20 bg-transparent px-2 text-[11px] text-white"
              >
                {WORKOUT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{titleWorkout(option)}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              await fetch('/api/glow/action-row/gym/weekly-plan', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  plans: (Object.keys(draft) as GymPlanDay[]).map((day) => ({
                    day_of_week: day,
                    workout_type: draft[day].workout_type,
                    is_active: draft[day].is_active,
                  })),
                }),
              });
              await load();
              setSaving(false);
            }}
            className="rounded-full border border-white/50 bg-transparent px-4 py-1.5 text-xs text-white hover:shadow-[0_0_14px_rgba(114,211,255,0.45)]"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GlowActionRow() {
  const [summary, setSummary] = useState<TodayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepsInput, setStepsInput] = useState('');
  const [teaOpen, setTeaOpen] = useState(false);
  const [gymLogOpen, setGymLogOpen] = useState(false);
  const [gymWeeklyOpen, setGymWeeklyOpen] = useState(false);

  const gymStatus = useMemo(() => {
    if (summary?.gym_today) return `${titleWorkout(summary.gym_today.workout_type)} ✔ ${summary.gym_today.duration_minutes}m`;
    if (summary?.gym_planned?.is_active) return `Planned: ${titleWorkout(summary.gym_planned.workout_type)}`;
    return 'Not logged';
  }, [summary]);

  const load = async () => {
    setLoading(true);
    const response = await fetch('/api/glow/action-row/today', { cache: 'no-store' });
    if (!response.ok) {
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as TodayPayload;
    setSummary(payload);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const applySummaryFromResponse = async (response: Response) => {
    if (!response.ok) return;
    const payload = (await response.json()) as TodayPayload & { ok?: boolean };
    if (payload && typeof payload.water_ml === 'number') setSummary(payload);
    else await load();
  };

  return (
    <>
      <div className="relative z-0 w-full overflow-hidden px-1 py-1 pb-2">
        <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4">
        <div className="flex h-[268px] min-h-[268px] min-w-0 w-full flex-col items-center justify-start gap-2 overflow-hidden px-1 text-white md:h-[280px] md:min-h-[280px]">
          <img
            src="/Images/GlowWorld/waterTracker.png"
            alt="Water sticker"
            className="h-[132px] max-h-[152px] w-auto max-w-[152px] object-contain transition-transform duration-300 hover:-translate-y-1 hover:drop-shadow-[0_0_20px_rgba(114,211,255,0.55)]"
            style={{ animation: 'gentleFloat 5.4s ease-in-out infinite' }}
          />
          <p className="h-5 whitespace-nowrap text-center text-sm text-white">{loading ? '...' : `${Math.round((summary?.water_ml ?? 0) / 250)}/8 cups`}</p>
          <div className="grid w-full max-w-[176px] grid-cols-2 gap-1.5">
            <button
              type="button"
              className="whitespace-nowrap rounded-full border border-white/55 bg-transparent px-2 py-1.5 text-[11px] text-white hover:shadow-[0_0_14px_rgba(114,211,255,0.45)]"
              onClick={async () => {
                const response = await fetch('/api/glow/action-row/water', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ amount_ml: 250 }),
                });
                await applySummaryFromResponse(response);
              }}
            >
              +1 cup
            </button>
            <button
              type="button"
              className="whitespace-nowrap rounded-full border border-white/55 bg-transparent px-2 py-1.5 text-[11px] text-white hover:shadow-[0_0_14px_rgba(114,211,255,0.45)]"
              onClick={async () => {
                const response = await fetch('/api/glow/action-row/water', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ amount_ml: 500 }),
                });
                await applySummaryFromResponse(response);
              }}
            >
              +2 cups
            </button>
          </div>
        </div>

        <div className="flex h-[268px] min-h-[268px] min-w-0 w-full flex-col items-center justify-start gap-2 overflow-hidden px-1 text-white md:h-[280px] md:min-h-[280px]">
          <button type="button" onClick={() => setTeaOpen(true)} className="bg-transparent">
            <img
              src="/Images/GlowWorld/teasticker.png"
              alt="Tea sticker"
              className="h-[132px] max-h-[152px] w-auto max-w-[152px] object-contain transition-transform duration-300 hover:-translate-y-1 hover:drop-shadow-[0_0_20px_rgba(114,211,255,0.55)]"
              style={{ animation: 'gentleFloat 5.1s ease-in-out infinite 0.25s' }}
            />
          </button>
          <p className="h-5 whitespace-nowrap text-center text-sm text-white">{loading ? '...' : `Today: ${summary?.tea_count_today ?? 0}`}</p>
          <div className="flex w-full items-center justify-center">
            <button type="button" onClick={() => setTeaOpen(true)} className="whitespace-nowrap rounded-full border border-white/50 bg-transparent px-3 py-1 text-[11px] text-white hover:shadow-[0_0_14px_rgba(114,211,255,0.45)]">Log Tea Today</button>
          </div>
        </div>

        <div className="flex h-[268px] min-h-[268px] min-w-0 w-full flex-col items-center justify-start gap-2 overflow-hidden px-1 text-white md:h-[280px] md:min-h-[280px]">
          <img
            src="/Images/GlowWorld/steps.png"
            alt="Steps sticker"
            className="h-[132px] max-h-[152px] w-auto max-w-[152px] object-contain transition-transform duration-300 hover:-translate-y-1 hover:drop-shadow-[0_0_20px_rgba(114,211,255,0.55)]"
            style={{ animation: 'gentleFloat 5.7s ease-in-out infinite 0.4s' }}
          />
          <p className="h-5 whitespace-nowrap text-center text-sm text-white">{loading ? '...' : `${summary?.steps_total ?? 0} today`}</p>
          <div className="grid w-full max-w-[156px] grid-cols-[72px_1fr] items-center gap-2">
            <input
              type="number"
              min="0"
              value={stepsInput}
              onChange={(event) => setStepsInput(event.target.value)}
              placeholder="steps"
              className="h-8 w-[72px] rounded-full border border-white/30 bg-transparent px-2 text-xs text-white"
            />
            <button
              type="button"
                className="whitespace-nowrap rounded-full border border-white/50 bg-transparent px-2 py-1 text-[11px] text-white hover:shadow-[0_0_14px_rgba(114,211,255,0.45)]"
              onClick={async () => {
                const value = Number(stepsInput);
                if (!Number.isFinite(value) || value <= 0) return;
                const response = await fetch('/api/glow/action-row/steps', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ steps: value }),
                });
                setStepsInput('');
                await applySummaryFromResponse(response);
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex h-[268px] min-h-[268px] min-w-0 w-full flex-col items-center justify-start gap-2 overflow-hidden px-1 text-white md:h-[280px] md:min-h-[280px]">
          <img
            src="/Images/GlowWorld/gymsticker.png"
            alt="Gym sticker"
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).src = '/SathiPlays/Images/GlowWorld/gymsticker.png';
            }}
            className="h-[140px] max-h-[156px] w-auto max-w-[162px] object-contain transition-transform duration-300 hover:-translate-y-1 hover:drop-shadow-[0_0_20px_rgba(114,211,255,0.55)]"
            style={{ animation: 'gentleFloat 5.2s ease-in-out infinite 0.55s' }}
          />
          <p className="h-5 w-full max-w-[160px] truncate whitespace-nowrap text-center text-sm text-white">{loading ? '...' : gymStatus}</p>
          <div className="grid w-full max-w-[156px] grid-cols-2 gap-2">
            <button type="button" onClick={() => setGymLogOpen(true)} className="whitespace-nowrap rounded-full border border-white/50 bg-transparent px-2 py-1 text-[11px] text-white hover:shadow-[0_0_14px_rgba(114,211,255,0.45)]">Log</button>
            <button type="button" onClick={() => setGymWeeklyOpen(true)} className="whitespace-nowrap rounded-full border border-white/50 bg-transparent px-2 py-1 text-[11px] text-white hover:shadow-[0_0_14px_rgba(114,211,255,0.45)]">Weekly</button>
          </div>
        </div>
      </div>
      </div>

      <TeaCheckInModal
        open={teaOpen}
        onClose={() => {
          setTeaOpen(false);
          void load();
        }}
      />
      <GymLogModal
        open={gymLogOpen}
        onClose={() => setGymLogOpen(false)}
        onSaved={load}
      />
      <GymWeeklyModal open={gymWeeklyOpen} onClose={() => setGymWeeklyOpen(false)} />

      <style jsx>{`
        @keyframes gentleFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-7px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </>
  );
}
