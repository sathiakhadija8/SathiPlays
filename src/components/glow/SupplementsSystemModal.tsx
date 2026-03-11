'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { WEEKDAY_SHORT, startOfWeekYMD } from '../../lib/glow-schedule';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

type FrequencyType = 'daily' | 'weekly' | 'monthly';
type TimeOfDay = 'morning' | 'evening' | 'night';
type IntakeMode = 'empty_stomach' | 'with_food';

type SystemItem = {
  id: number;
  name: string;
  dosage: string | null;
  frequency_type: FrequencyType;
  times_per_day: number;
  day_of_week: number | null;
  days_of_week?: number[];
  specific_date: number | null;
  time_of_day: TimeOfDay;
  primary_time: string | null;
  secondary_time: string | null;
  intake_mode: IntakeMode;
  is_active: number;
  created_at: string;
};

type WeekItem = {
  log_id: number;
  supplement_id: number;
  supplement_name: string;
  dosage: string | null;
  frequency_type: FrequencyType;
  times_per_day: number;
  time_of_day: TimeOfDay;
  due_time: string;
  scheduled_datetime: string;
  completed: boolean;
  completed_at: string | null;
};

type WeekResponse = {
  startDate: string;
  days: Array<{ date: string; day_of_week: number; day_label: string; items: WeekItem[] }>;
};

type SupplementDraft = {
  name: string;
  dosage: string;
  frequency_type: FrequencyType;
  times_per_day: 1 | 2;
  days_of_week: number[];
  specific_date: number | null;
  time_of_day: TimeOfDay;
  primary_time: string;
  secondary_time: string;
  intake_mode: IntakeMode;
  is_active: 0 | 1;
};

const EMPTY_DRAFT: SupplementDraft = {
  name: '',
  dosage: '',
  frequency_type: 'daily',
  times_per_day: 1,
  days_of_week: [],
  specific_date: null,
  time_of_day: 'morning',
  primary_time: '08:00',
  secondary_time: '20:00',
  intake_mode: 'with_food',
  is_active: 1,
};

function defaultPrimaryTime(timeOfDay: TimeOfDay) {
  if (timeOfDay === 'evening') return '18:00';
  if (timeOfDay === 'night') return '22:00';
  return '08:00';
}

function defaultSecondaryTime(primaryTime: string) {
  return primaryTime < '12:00' ? '20:00' : '08:00';
}

function normalizeClockTime(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) return trimmed;
  if (/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(trimmed)) return trimmed.slice(0, 5);
  return null;
}

function toDraft(item: SystemItem): SupplementDraft {
  const primary = normalizeClockTime(item.primary_time) ?? defaultPrimaryTime(item.time_of_day);
  const secondaryRaw = normalizeClockTime(item.secondary_time) ?? defaultSecondaryTime(primary);
  const secondary = secondaryRaw === primary ? defaultSecondaryTime(primary) : secondaryRaw;
  return {
    name: item.name,
    dosage: item.dosage ?? '',
    frequency_type: item.frequency_type,
    times_per_day: Number(item.times_per_day) === 2 ? 2 : 1,
    days_of_week: Array.isArray(item.days_of_week)
      ? item.days_of_week.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : item.day_of_week === null
        ? []
        : [item.day_of_week],
    specific_date: item.specific_date ?? null,
    time_of_day: item.time_of_day,
    primary_time: primary,
    secondary_time: secondary,
    intake_mode: item.intake_mode === 'empty_stomach' ? 'empty_stomach' : 'with_food',
    is_active: Number(item.is_active) === 1 ? 1 : 0,
  };
}

function toggleDay(days: number[], day: number) {
  if (days.includes(day)) return days.filter((entry) => entry !== day);
  return [...days, day].sort((a, b) => a - b);
}

function weeklyDaysLabel(days: number[]) {
  if (!days.length) return '--';
  return days.map((day) => WEEKDAY_SHORT[day] ?? '').filter(Boolean).join(', ');
}

export function SupplementsSystemModal({
  open,
  onClose,
  onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<SystemItem[]>([]);
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [newItem, setNewItem] = useState<SupplementDraft>(EMPTY_DRAFT);
  const [drafts, setDrafts] = useState<Record<number, SupplementDraft>>({});
  const [savingNew, setSavingNew] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => new Date().getDay(), []);

  usePlatformWindowOpen(open);
  useEffect(() => setMounted(true), []);

  const loadSystem = async () => {
    setError(null);
    const [systemRes, weekRes] = await Promise.all([
      fetch('/api/glow/supplements/system', { cache: 'no-store' }),
      fetch(`/api/glow/supplements/week?startDate=${startOfWeekYMD()}`, { cache: 'no-store' }),
    ]);

    if (systemRes.ok) {
      const payload = (await systemRes.json()) as SystemItem[];
      const nextItems = Array.isArray(payload) ? payload : [];
      setItems(nextItems);
      const nextDrafts: Record<number, SupplementDraft> = {};
      for (const item of nextItems) nextDrafts[item.id] = toDraft(item);
      setDrafts(nextDrafts);
    } else {
      setItems([]);
    }

    if (weekRes.ok) {
      const payload = (await weekRes.json()) as WeekResponse;
      setWeek(payload);
    } else {
      setWeek(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadSystem();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitNew = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!newItem.name.trim()) {
      setError('Supplement name is required.');
      return;
    }
    if (newItem.frequency_type === 'weekly' && newItem.days_of_week.length === 0) {
      setError('Select at least one weekday for weekly supplements.');
      return;
    }
    if (newItem.frequency_type === 'monthly') {
      const date = Number(newItem.specific_date ?? 0);
      if (!Number.isInteger(date) || date < 1 || date > 31) {
        setError('Monthly supplements require a date between 1 and 31.');
        return;
      }
    }
    if (newItem.times_per_day === 2) {
      const firstTime = normalizeClockTime(newItem.primary_time);
      const secondTime = normalizeClockTime(newItem.secondary_time);
      if (!firstTime || !secondTime || firstTime === secondTime) {
        setError('For 2 times/day, choose two different valid times.');
        return;
      }
    }

    setSavingNew(true);
    const response = await fetch('/api/glow/supplements/system/supplement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newItem,
        day_of_week: newItem.days_of_week[0] ?? null,
        name: newItem.name.trim(),
        dosage: newItem.dosage.trim() || null,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? 'Unable to create supplement.');
      setSavingNew(false);
      return;
    }

    setNewItem(EMPTY_DRAFT);
    await loadSystem();
    await onUpdated();
    setSavingNew(false);
  };

  const saveItem = async (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    setError(null);
    if (!draft.name.trim()) {
      setError('Supplement name is required.');
      return;
    }
    if (draft.frequency_type === 'weekly' && draft.days_of_week.length === 0) {
      setError('Weekly supplements require at least one weekday.');
      return;
    }
    if (draft.frequency_type === 'monthly') {
      const day = Number(draft.specific_date ?? 0);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        setError('Monthly supplements require a date between 1 and 31.');
        return;
      }
    }
    if (draft.times_per_day === 2) {
      const firstTime = normalizeClockTime(draft.primary_time);
      const secondTime = normalizeClockTime(draft.secondary_time);
      if (!firstTime || !secondTime || firstTime === secondTime) {
        setError('For 2/day, choose two different valid times.');
        return;
      }
    }

    setSavingId(id);
    const response = await fetch(`/api/glow/supplements/system/supplement/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...draft,
        day_of_week: draft.days_of_week[0] ?? null,
        name: draft.name.trim(),
        dosage: draft.dosage.trim() || null,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? 'Unable to save supplement.');
      setSavingId(null);
      return;
    }

    await loadSystem();
    await onUpdated();
    setSavingId(null);
  };

  const removeItem = async (id: number) => {
    setDeletingId(id);
    await fetch(`/api/glow/supplements/system/supplement/${id}`, { method: 'DELETE' });
    await loadSystem();
    await onUpdated();
    setDeletingId(null);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-3 backdrop-blur-sm">
      <div className="flex h-[min(84vh,760px)] w-full max-w-[1040px] flex-col rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.62)] p-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-serif text-xl text-[#F8F4FF]">Supplements System</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">
            Close
          </button>
        </div>

        <form className="mb-2 rounded-2xl border border-white/10 bg-black/20 p-2.5" onSubmit={submitNew}>
          <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.16em] text-[#B9B4D9]">Add Supplement</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <input
              value={newItem.name}
              onChange={(event) => setNewItem((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Supplement name"
              className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            />
            <input
              value={newItem.dosage}
              onChange={(event) => setNewItem((prev) => ({ ...prev, dosage: event.target.value }))}
              placeholder="Dosage"
              className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            />
            <select
              value={newItem.frequency_type}
              onChange={(event) =>
                setNewItem((prev) => ({
                  ...prev,
                  frequency_type: event.target.value as FrequencyType,
                  days_of_week: event.target.value === 'weekly' ? (prev.days_of_week.length > 0 ? prev.days_of_week : [today]) : [],
                  specific_date: event.target.value === 'monthly' ? prev.specific_date ?? 1 : null,
                }))
              }
              className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              value={String(newItem.times_per_day)}
              onChange={(event) =>
                setNewItem((prev) => {
                  const nextTimes = Number(event.target.value) === 2 ? 2 : 1;
                  if (nextTimes === 1) return { ...prev, times_per_day: 1 };
                  const primary = normalizeClockTime(prev.primary_time) ?? defaultPrimaryTime(prev.time_of_day);
                  const secondaryRaw = normalizeClockTime(prev.secondary_time) ?? defaultSecondaryTime(primary);
                  const secondary = secondaryRaw === primary ? defaultSecondaryTime(primary) : secondaryRaw;
                  return { ...prev, times_per_day: 2, primary_time: primary, secondary_time: secondary };
                })
              }
              className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            >
              <option value="1">1 time/day</option>
              <option value="2">2 times/day</option>
            </select>
            <select
              value={newItem.time_of_day}
              onChange={(event) =>
                setNewItem((prev) => {
                  const nextTimeOfDay = event.target.value as TimeOfDay;
                  if (prev.times_per_day === 2) return { ...prev, time_of_day: nextTimeOfDay };
                  return { ...prev, time_of_day: nextTimeOfDay, primary_time: defaultPrimaryTime(nextTimeOfDay) };
                })
              }
              className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            >
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
            </select>
            <select
              value={newItem.intake_mode}
              onChange={(event) => setNewItem((prev) => ({ ...prev, intake_mode: event.target.value as IntakeMode }))}
              className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            >
              <option value="with_food">With food</option>
              <option value="empty_stomach">Empty stomach</option>
            </select>
            {newItem.times_per_day === 2 && (
              <>
                <input
                  type="time"
                  value={newItem.primary_time}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, primary_time: event.target.value }))}
                  className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
                />
                <input
                  type="time"
                  value={newItem.secondary_time}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, secondary_time: event.target.value }))}
                  className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
                />
              </>
            )}
            {newItem.frequency_type === 'weekly' ? (
              <div className="col-span-full flex flex-wrap gap-1.5">
                {WEEKDAY_SHORT.map((label, index) => {
                  const selected = newItem.days_of_week.includes(index);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setNewItem((prev) => ({ ...prev, days_of_week: toggleDay(prev.days_of_week, index) }))}
                      className={`h-8 rounded-full border px-3 text-xs ${
                        selected ? 'border-[#FF3EA5] bg-[#FF3EA5] text-white' : 'border-white/25 bg-transparent text-[#F8F4FF]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : newItem.frequency_type === 'monthly' ? (
              <input
                type="number"
                min="1"
                max="31"
                value={String(newItem.specific_date ?? 1)}
                onChange={(event) => setNewItem((prev) => ({ ...prev, specific_date: Number(event.target.value) }))}
                placeholder="Date (1-31)"
                className="h-9 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-[#F8F4FF]"
              />
            ) : (
              <div className="h-9 rounded-xl border border-white/10 bg-black/10 px-3 text-xs text-[#B9B4D9] flex items-center">
                Daily schedule
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={savingNew}
              className="h-9 rounded-xl border border-[#FF3EA566] bg-[#FF3EA522] px-4 text-xs text-[#F8F4FF]"
            >
              {savingNew ? 'Saving...' : 'Add Supplement'}
            </button>
          </div>
        </form>

        <div className="mb-2 rounded-2xl border border-white/10 bg-black/20 p-2.5">
          <p className="mb-2 font-sans text-[10px] uppercase tracking-[0.16em] text-[#B9B4D9]">Weekly Plan</p>
          <div className="grid grid-cols-7 gap-1.5">
            {(week?.days ?? WEEKDAY_SHORT.map((label, day) => ({ day_label: label, day_of_week: day, date: '', items: [] }))).map((day) => (
              <div
                key={`${day.day_of_week}-${day.day_label}`}
                className={`rounded-xl border p-1.5 ${
                  day.day_of_week === today ? 'border-[#FF3EA577] bg-[#FF3EA522]' : 'border-white/10 bg-black/20'
                }`}
              >
                <p className={`text-center text-[11px] ${day.day_of_week === today ? 'text-[#F8F4FF]' : 'text-[#B9B4D9]'}`}>
                  {day.day_label}
                </p>
                <div className="mt-1 max-h-24 space-y-1 overflow-y-auto pr-0.5">
                  {(day.items ?? []).slice(0, 8).map((entry) => (
                    <p key={entry.log_id} className={`rounded-md border px-1.5 py-0.5 text-[10px] ${entry.completed ? 'border-[#47d58c66] bg-[#47d58c1f] text-[#baf7d4]' : 'border-white/10 bg-black/25 text-[#F8F4FF]'}`}>
                      {entry.supplement_name} {entry.due_time}
                    </p>
                  ))}
                  {(day.items ?? []).length === 0 && <p className="text-center text-[10px] text-[#7f7b98]">-</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="mb-2 font-sans text-xs text-[#ff9acb]">{error}</p>}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => {
            const draft = drafts[item.id] ?? toDraft(item);
            return (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-2.5">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <input
                    value={draft.name}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, name: event.target.value } }))}
                    className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                  />
                  <input
                    value={draft.dosage}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, dosage: event.target.value } }))}
                    placeholder="Dosage"
                    className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                  />
                  <select
                    value={draft.frequency_type}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...draft,
                          frequency_type: event.target.value as FrequencyType,
                          days_of_week:
                            event.target.value === 'weekly'
                              ? draft.days_of_week.length > 0
                                ? draft.days_of_week
                                : [today]
                              : [],
                          specific_date: event.target.value === 'monthly' ? draft.specific_date ?? 1 : null,
                        },
                      }))
                    }
                    className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <select
                    value={String(draft.times_per_day)}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.id]: (() => {
                          const nextTimes = Number(event.target.value) === 2 ? 2 : 1;
                          if (nextTimes === 1) return { ...draft, times_per_day: 1 };
                          const primary = normalizeClockTime(draft.primary_time) ?? defaultPrimaryTime(draft.time_of_day);
                          const secondaryRaw = normalizeClockTime(draft.secondary_time) ?? defaultSecondaryTime(primary);
                          const secondary = secondaryRaw === primary ? defaultSecondaryTime(primary) : secondaryRaw;
                          return { ...draft, times_per_day: 2, primary_time: primary, secondary_time: secondary };
                        })(),
                      }))
                    }
                    className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                  >
                    <option value="1">1/day</option>
                    <option value="2">2/day</option>
                  </select>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-7">
                  <select
                    value={draft.time_of_day}
                    onChange={(event) =>
                      setDrafts((prev) => {
                        const nextTimeOfDay = event.target.value as TimeOfDay;
                        if (draft.times_per_day === 2) {
                          return { ...prev, [item.id]: { ...draft, time_of_day: nextTimeOfDay } };
                        }
                        return {
                          ...prev,
                          [item.id]: { ...draft, time_of_day: nextTimeOfDay, primary_time: defaultPrimaryTime(nextTimeOfDay) },
                        };
                      })
                    }
                    className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                  >
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                    <option value="night">Night</option>
                  </select>
                  <select
                    value={draft.intake_mode}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, intake_mode: event.target.value as IntakeMode } }))}
                    className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                  >
                    <option value="with_food">With food</option>
                    <option value="empty_stomach">Empty stomach</option>
                  </select>
                  {draft.times_per_day === 2 && (
                    <>
                      <input
                        type="time"
                        value={draft.primary_time}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, primary_time: event.target.value } }))}
                        className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                      />
                      <input
                        type="time"
                        value={draft.secondary_time}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, secondary_time: event.target.value } }))}
                        className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                      />
                    </>
                  )}
                  {draft.frequency_type === 'weekly' ? (
                    <div className="md:col-span-2 flex flex-wrap gap-1.5">
                      {WEEKDAY_SHORT.map((label, index) => {
                        const selected = draft.days_of_week.includes(index);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() =>
                              setDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, days_of_week: toggleDay(draft.days_of_week, index) },
                              }))
                            }
                            className={`h-8 rounded-full border px-2.5 text-xs ${
                              selected
                                ? 'border-[#FF3EA5] bg-[#FF3EA5] text-white'
                                : 'border-white/25 bg-transparent text-[#F8F4FF]'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : draft.frequency_type === 'monthly' ? (
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={String(draft.specific_date ?? 1)}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, specific_date: Number(event.target.value) } }))}
                      className="h-8 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-[#F8F4FF]"
                    />
                  ) : (
                    <div className="h-8 rounded-lg border border-white/10 bg-black/10 px-2 text-xs text-[#B9B4D9] flex items-center">
                      Daily
                    </div>
                  )}
                  <div className="h-8 rounded-lg border border-white/10 bg-black/10 px-2 text-xs text-[#B9B4D9] flex items-center">
                    {draft.frequency_type === 'weekly'
                      ? `Days: ${weeklyDaysLabel(draft.days_of_week)}`
                      : draft.frequency_type === 'monthly'
                        ? `Date: ${draft.specific_date ?? '-'}`
                        : 'Every day'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrafts((prev) => ({ ...prev, [item.id]: { ...draft, is_active: draft.is_active ? 0 : 1 } }))}
                    className={`h-8 rounded-lg border px-2 text-xs ${draft.is_active ? 'border-[#47d58c66] bg-[#47d58c22] text-[#baf7d4]' : 'border-white/20 bg-white/10 text-[#B9B4D9]'}`}
                  >
                    {draft.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={savingId === item.id}
                    onClick={() => void saveItem(item.id)}
                    className="rounded-full border border-[#C084FC66] bg-[#C084FC22] px-3 py-1 text-xs text-[#F8F4FF]"
                  >
                    {savingId === item.id ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === item.id}
                    onClick={() => void removeItem(item.id)}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#ff9acb]"
                  >
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="font-sans text-sm text-[#B9B4D9]">No supplements yet.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
