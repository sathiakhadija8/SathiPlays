'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BackgroundShell } from '../layout/BackgroundShell';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import { ClosetPortals } from './ClosetPortals';

const ROOM_OPTIONS = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'living', label: 'Living Room' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'balcony', label: 'Balcony' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'closet', label: 'Closet' },
  { value: 'whole_home', label: 'Whole Home' },
] as const;
const FREQUENCY_OPTIONS = ['daily', 'weekly', 'monthly'] as const;
const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_INDEX = new Map(DAY_OPTIONS.map((day, index) => [day, index]));

function glassCard(extra = '') {
  return `rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] backdrop-blur-xl ${extra}`;
}

type HomeTask = {
  id: number;
  routine_id: number;
  title: string;
  order_index: number;
  estimated_minutes: number;
};

type HomeRoutine = {
  id: number;
  name: string;
  room: string;
  frequency: string;
  active_days: string[] | string | null;
  time_limit_minutes: number;
  scheduled_time: string;
  is_active: boolean;
  tasks: HomeTask[];
};

type HomePlayTask = {
  id: number;
  routine_id: number;
  routine_name: string;
  room: string;
  title: string;
  order_index: number;
  estimated_minutes: number;
  time_limit_minutes?: number;
  scheduled_time?: string;
  is_completed: boolean;
};

type HomeTodayTasksResponse = {
  date: string;
  weekday: string;
  tasks: HomePlayTask[];
  completed_task_ids: number[];
  total_pending: number;
  mode?: 'default' | 'replay';
};

type ClosetState = 'in_closet' | 'dirty' | 'in_laundry' | 'drying' | 'folded';

type ClosetItem = {
  id: number;
  name: string;
  size: string | null;
  category: string | null;
  image_path: string | null;
  state: ClosetState;
  updated_at: string;
};

type ClosetCounts = Record<ClosetState, number>;

type ClosetResponse = {
  items: ClosetItem[];
  counts: ClosetCounts;
};

type PlantStatus = {
  plant: {
    id: number;
    name: string;
    watering_frequency_days: number;
    last_watered_at: string | null;
    next_watering_at: string;
  };
  due: boolean;
  watered_today: boolean;
};

function daySortIndex(day: string) {
  return DAY_INDEX.get(day as (typeof DAY_OPTIONS)[number]) ?? 99;
}

const CLOSET_STATES: ClosetState[] = ['in_closet', 'dirty', 'in_laundry', 'drying', 'folded'];
const CLOSET_STATE_LABELS: Record<ClosetState, string> = {
  in_closet: 'In Closet',
  dirty: 'Dirty',
  in_laundry: 'In Laundry',
  drying: 'Drying',
  folded: 'Folded',
};

function parseActiveDays(value: HomeRoutine['active_days']) {
  const normalize = (source: string[]) =>
    Array.from(new Set(source.filter((v) => DAY_OPTIONS.includes(v as (typeof DAY_OPTIONS)[number])))).sort(
      (a, b) => daySortIndex(a) - daySortIndex(b),
    );

  if (Array.isArray(value)) {
    return normalize(value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return normalize(parsed.filter((v): v is string => typeof v === 'string').map((v) => v.trim()));
      }
      if (typeof parsed === 'string') {
        return normalize(parsed.split(',').map((item) => item.trim()).filter(Boolean));
      }
      return [];
    } catch {
      return normalize(value.split(',').map((item) => item.trim()).filter(Boolean));
    }
  }
  return [];
}

function scheduledTimeForInput(value: string | null | undefined) {
  if (!value) return '08:00';
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return '08:00';
  return `${match[1]}:${match[2]}`;
}

function roomLabel(room: string) {
  if (room === 'whole_home') return 'Whole Home';
  if (room === 'living') return 'Living Room';
  return room.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function PlantSticker({ sizeClass = 'h-[min(22vw,160px)] w-[min(22vw,160px)] max-h-[160px] max-w-[160px]' }: { sizeClass?: string }) {
  const [status, setStatus] = useState<PlantStatus | null>(null);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [watering, setWatering] = useState(false);
  const [flashingGreen, setFlashingGreen] = useState(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch('/api/home/plants/status', { cache: 'no-store' });
    const payload = (await response.json()) as PlantStatus;
    if (!response.ok) return;
    setStatus(payload);
  }, []);

  useEffect(() => {
    void loadStatus();
    const timer = setInterval(() => {
      void loadStatus();
    }, 60000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  const waterPlant = async () => {
    if (!status?.plant?.id) return;
    setWatering(true);
    await fetch('/api/home/plants/water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plant_id: status.plant.id }),
    });
    await loadStatus();
    setOpenConfirm(false);
    setWatering(false);
    setFlashingGreen(true);
    setTimeout(() => setFlashingGreen(false), 900);
  };

  const due = Boolean(status?.due);

  return (
    <div className="relative">
      <button
        onClick={() => setOpenConfirm(true)}
        className={`${sizeClass} rounded-full text-2xl transition-all duration-200 hover:-translate-y-[2px] ${
          due
            ? 'animate-pulse border border-[#ff6b8f] bg-[#4a1b2ecc] shadow-[0_0_22px_rgba(255,86,120,0.55)]'
            : flashingGreen
              ? 'border border-[#75ffa5] bg-[#1f3a2bcc] shadow-[0_0_26px_rgba(117,255,165,0.6)]'
              : 'float-a border border-[#8cffb355] bg-[#203329cc] shadow-[0_0_16px_rgba(140,255,179,0.35)]'
        }`}
        aria-label="Plant sticker"
      >
        <img
          src="/SathiPlays/Images/plants.png"
          alt="Plant sticker"
          className="h-full w-full rounded-full object-contain p-1.5"
        />
      </button>

      {openConfirm && (
        <div className="absolute -top-20 right-0 z-40 rounded-2xl border border-white/20 bg-[rgba(20,18,42,0.9)] px-3 py-2 shadow-[0_0_18px_rgba(255,62,165,0.25)] backdrop-blur-lg">
          <p className="font-serif text-sm text-[#F8F4FF]">Water plant?</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void waterPlant()}
              disabled={watering}
              className="rounded-full border border-[#FF3EA588] bg-[#FF3EA530] px-3 py-1 text-[11px] text-[#F8F4FF] disabled:opacity-50"
            >
              {watering ? 'Saving...' : 'Yes'}
            </button>
            <button
              onClick={() => setOpenConfirm(false)}
              className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-[#F8F4FF]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoutineSystemModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routines, setRoutines] = useState<HomeRoutine[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [room, setRoom] = useState<string>('bedroom');
  const [frequency, setFrequency] = useState<string>('daily');
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('60');
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [isActive, setIsActive] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskMinutes, setNewTaskMinutes] = useState('10');
  const [taskTitleDrafts, setTaskTitleDrafts] = useState<Record<number, string>>({});

  usePlatformWindowOpen(open);

  const loadRoutines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/home/routines', { cache: 'no-store' });
      const payload = (await response.json()) as HomeRoutine[] | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        setRoutines([]);
        setSelectedRoutineId(null);
        setLoadError(typeof payload === 'object' && payload && 'message' in payload ? String(payload.message ?? 'Unable to load routines.') : 'Unable to load routines.');
        return;
      }
      const next = payload.map((routine) => ({
        ...routine,
        active_days: parseActiveDays(routine.active_days),
        time_limit_minutes: Number(routine.time_limit_minutes ?? 60),
        scheduled_time: routine.scheduled_time ?? '08:00:00',
        tasks: (routine.tasks ?? []).slice().sort((a, b) => a.order_index - b.order_index || a.id - b.id),
      }));
      setRoutines(next);
      setSelectedRoutineId((prev) => {
        if (prev && next.some((routine) => routine.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
      setLoadError('');
    } catch {
      setRoutines([]);
      setSelectedRoutineId(null);
      setLoadError('Unable to load routines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadRoutines();
  }, [open, loadRoutines]);

  const selectedRoutine = useMemo(
    () => routines.find((routine) => routine.id === selectedRoutineId) ?? null,
    [routines, selectedRoutineId],
  );

  useEffect(() => {
    if (!selectedRoutine) {
      setName('');
      setRoom('bedroom');
      setFrequency('daily');
      setActiveDays([]);
      setTimeLimitMinutes('60');
      setScheduledTime('08:00');
      setIsActive(true);
      return;
    }

    setName(selectedRoutine.name);
    setRoom(selectedRoutine.room);
    setFrequency(selectedRoutine.frequency);
    setActiveDays(parseActiveDays(selectedRoutine.active_days));
    setTimeLimitMinutes(String(Math.max(1, Number(selectedRoutine.time_limit_minutes ?? 60))));
    setScheduledTime(scheduledTimeForInput(selectedRoutine.scheduled_time));
    setIsActive(Boolean(selectedRoutine.is_active));
  }, [selectedRoutine]);

  const createRoutine = async () => {
    if (!name.trim()) return;
    if (activeDays.length === 0) {
      setLoadError('Select at least one weekday.');
      return;
    }
    if (!scheduledTime) {
      setLoadError('Select a scheduled time.');
      return;
    }
    const response = await fetch('/api/home/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        room,
        frequency,
        active_days: activeDays,
        time_limit_minutes: Number(timeLimitMinutes || 60),
        scheduled_time: scheduledTime,
        is_active: isActive,
      }),
    });
    const payload = (await response.json()) as { insertedId?: unknown; message?: string };
    if (!response.ok) {
      setLoadError(typeof payload.message === 'string' ? payload.message : 'Unable to create routine.');
      return;
    }
    const insertedId = Number(payload.insertedId);
    if (Number.isInteger(insertedId) && insertedId > 0) {
      setSelectedRoutineId(insertedId);
    }
    await loadRoutines();
  };

  const updateRoutine = async () => {
    if (!selectedRoutineId || !name.trim()) return;
    if (activeDays.length === 0) {
      setLoadError('Select at least one weekday.');
      return;
    }
    if (!scheduledTime) {
      setLoadError('Select a scheduled time.');
      return;
    }
    const response = await fetch(`/api/home/routines/${selectedRoutineId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        room,
        frequency,
        active_days: activeDays,
        time_limit_minutes: Number(timeLimitMinutes || 60),
        scheduled_time: scheduledTime,
        is_active: isActive,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { message?: string };
      setLoadError(typeof payload.message === 'string' ? payload.message : 'Unable to update routine.');
      return;
    }
    await loadRoutines();
  };

  const deleteRoutine = async () => {
    if (!selectedRoutineId) return;
    await fetch(`/api/home/routines/${selectedRoutineId}`, { method: 'DELETE' });
    setSelectedRoutineId(null);
    await loadRoutines();
  };

  const addTask = async () => {
    if (!selectedRoutineId || !newTaskTitle.trim()) return;
    await fetch(`/api/home/routines/${selectedRoutineId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTaskTitle.trim(),
        estimated_minutes: Number(newTaskMinutes || 0),
      }),
    });
    setNewTaskTitle('');
    setNewTaskMinutes('10');
    await loadRoutines();
  };

  const patchTask = async (taskId: number, body: Record<string, unknown>) => {
    await fetch(`/api/home/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  const saveTaskTitle = async (task: HomeTask) => {
    const nextTitle = (taskTitleDrafts[task.id] ?? task.title).trim();
    if (!nextTitle) return;
    await patchTask(task.id, { title: nextTitle });
    await loadRoutines();
  };

  const moveTask = async (taskId: number, direction: 'up' | 'down') => {
    if (!selectedRoutine) return;
    const tasks = selectedRoutine.tasks;
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index < 0) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= tasks.length) return;

    const current = tasks[index];
    const target = tasks[swapIndex];

    await patchTask(current.id, { order_index: target.order_index });
    await patchTask(target.id, { order_index: current.order_index });
    await loadRoutines();
  };

  const removeTask = async (taskId: number) => {
    await fetch(`/api/home/tasks/${taskId}`, { method: 'DELETE' });
    await loadRoutines();
  };

  const toggleWeekday = (day: string) => {
    setActiveDays((prev) => {
      const next = prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day];
      return next.sort((a, b) => daySortIndex(a) - daySortIndex(b));
    });
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <div
        className={`${glassCard('flex h-[min(88vh,780px)] w-full max-w-6xl flex-col border-[#FF3EA566] bg-cover bg-center bg-no-repeat p-4')}`}
        style={{ backgroundImage: "url('/Images/HomeWorld/homesystem.png?v=20260303b')" }}
      >
        <div className="mb-3 flex items-center justify-between border-b border-[#FF3EA566] pb-2">
          <h3
            className="font-serif text-2xl text-[#B93853]"
            style={{ textShadow: '0 0 12px rgba(183, 204, 255, 0.6)' }}
          >
            Routine System
          </h3>
          <button onClick={onClose} className="rounded-full border border-[#FF3EA588] bg-[#FF3EA522] px-3 py-1 text-xs text-white/90">Close</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[34%_66%] gap-3 overflow-hidden">
          <section className="flex min-h-0 flex-col rounded-2xl border border-[#FF3EA566] bg-[rgba(168,143,195,0.90)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-serif text-lg text-[#B93853]">Routines</p>
              <button
                onClick={() => {
                  setSelectedRoutineId(null);
                  setName('');
                  setRoom('bedroom');
                  setFrequency('daily');
                  setActiveDays([]);
                  setTimeLimitMinutes('60');
                  setScheduledTime('08:00');
                  setIsActive(true);
                  setTaskTitleDrafts({});
                }}
                className="rounded-full border border-[#FF3EA588] bg-[#FF3EA522] px-2 py-0.5 text-[10px] text-white/90"
              >
                + New
              </button>
            </div>
            {loadError ? <p className="mb-2 text-[11px] text-[#651021]">{loadError}</p> : null}

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {loading ? (
                <p className="text-sm text-white/60">Loading...</p>
              ) : routines.length === 0 ? (
                <p className="text-sm text-white/60">No routines yet.</p>
              ) : (
                routines.map((routine) => (
                  <button
                    key={routine.id}
                    onClick={() => {
                      setSelectedRoutineId(routine.id);
                      setTaskTitleDrafts({});
                    }}
                    className={`w-full rounded-xl border px-2 py-2 text-left transition-all duration-200 ${
                      selectedRoutineId === routine.id
                        ? 'border-[#FF3EA566] bg-[#FF3EA522]'
                        : 'border-[#FF3EA544] bg-[#FF3EA518] hover:border-[#FF3EA588]'
                    }`}
                  >
                    <p className="text-sm text-white/90">{routine.name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/60">
                      {routine.room} • {routine.frequency} • {scheduledTimeForInput(routine.scheduled_time)} • {routine.time_limit_minutes}m
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="grid min-h-0 grid-rows-[minmax(0,42%)_minmax(0,58%)] gap-3 overflow-hidden">
            <div className="flex min-h-0 flex-col rounded-2xl border border-[#FF3EA566] bg-[rgba(168,143,195,0.90)] p-3">
              <p className="mb-2 font-serif text-lg text-[#B93853]">Routine Settings</p>
              <div className="grid grid-cols-2 gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Routine name" className="col-span-2 rounded-lg border border-[#FF3EA566] bg-[#FF3EA514] px-2 py-1 text-sm text-white/90 placeholder:text-white/60" />
                <select value={room} onChange={(e) => setRoom(e.target.value)} className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA514] px-2 py-1 text-sm text-white/90">
                  {ROOM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA514] px-2 py-1 text-sm text-white/90">
                  {FREQUENCY_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={timeLimitMinutes}
                  onChange={(e) => setTimeLimitMinutes(e.target.value)}
                  placeholder="Time limit (min)"
                  className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA514] px-2 py-1 text-sm text-white/90 placeholder:text-white/60"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA514] px-2 py-1 text-sm text-white/90"
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {DAY_OPTIONS.map((day) => {
                  const active = activeDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekday(day)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] transition-all duration-150 ${
                        active
                          ? 'border-[#ff4da6] bg-[#FF3EA5] text-white shadow-[0_0_12px_rgba(255,62,165,0.35)]'
                          : 'border-[#FF3EA588] bg-transparent text-white/70 hover:bg-[#FF3EA514]'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <label className="mt-2 inline-flex items-center gap-2 text-xs text-white/90">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-3.5 w-3.5 accent-[#FF3EA5]" />
                Active
              </label>

              <div className="mt-2 flex gap-2">
                <button onClick={() => void createRoutine()} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-white/90">Create</button>
                <button onClick={() => void updateRoutine()} disabled={!selectedRoutineId} className="rounded-full border border-[#FF3EA588] bg-[#FF3EA514] px-3 py-1 text-xs text-white/90 disabled:opacity-40">Save</button>
                <button onClick={() => void deleteRoutine()} disabled={!selectedRoutineId} className="rounded-full border border-[#FF3EA544] px-3 py-1 text-xs text-white/90 disabled:opacity-40">Delete</button>
              </div>
            </div>

            <div className="flex min-h-0 flex-col rounded-2xl border border-[#FF3EA566] bg-[rgba(168,143,195,0.90)] p-3">
              <p
                className="mb-2 font-serif text-lg text-[#B93853]"
                style={{ textShadow: '0 0 10px rgba(185, 56, 83, 0.35)' }}
              >
                Tasks
              </p>

              <div className="mb-2 grid grid-cols-[1fr_90px_auto] gap-2">
                <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Task title" className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA514] px-2 py-1 text-sm text-white/90 placeholder:text-white/60" />
                <input value={newTaskMinutes} onChange={(e) => setNewTaskMinutes(e.target.value)} placeholder="Minutes" className="rounded-lg border border-[#FF3EA566] bg-[#FF3EA514] px-2 py-1 text-sm text-white/90 placeholder:text-white/60" />
                <button onClick={() => void addTask()} disabled={!selectedRoutineId} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-white/90 disabled:opacity-40">Add</button>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {!selectedRoutine ? (
                  <p className="text-sm text-white/60">Select or create a routine to manage tasks.</p>
                ) : selectedRoutine.tasks.length === 0 ? (
                  <p className="text-sm text-white/60">No tasks yet.</p>
                ) : (
                  selectedRoutine.tasks.map((task, index) => (
                    <div key={task.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-[#FF3EA544] bg-[#FF3EA518] px-2 py-1.5">
                      <input
                        value={taskTitleDrafts[task.id] ?? task.title}
                        onChange={(e) => setTaskTitleDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        className="rounded-md border border-transparent bg-transparent px-1 py-1 text-xs text-white/90 outline-none focus:border-[#FF3EA566] focus:bg-[#FF3EA514]"
                      />
                      <div className="flex gap-1">
                        <button onClick={() => void moveTask(task.id, 'up')} disabled={index === 0} className="rounded border border-[#FF3EA588] bg-[#FF3EA514] px-1 py-0.5 text-[10px] text-white/90 disabled:opacity-30">↑</button>
                        <button onClick={() => void moveTask(task.id, 'down')} disabled={index === selectedRoutine.tasks.length - 1} className="rounded border border-[#FF3EA588] bg-[#FF3EA514] px-1 py-0.5 text-[10px] text-white/90 disabled:opacity-30">↓</button>
                        <button onClick={() => void saveTaskTitle(task)} className="rounded border border-[#FF3EA588] bg-[#FF3EA514] px-1 py-0.5 text-[10px] text-white/90">Save</button>
                        <button onClick={() => void removeTask(task.id)} className="rounded border border-[#FF3EA544] px-1 py-0.5 text-[10px] text-white/90">Del</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HomePlayOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<HomePlayTask[]>([]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [playMode, setPlayMode] = useState<'default' | 'replay'>('default');
  const [completedTaskIds, setCompletedTaskIds] = useState<number[]>([]);
  usePlatformWindowOpen(open);

  const loadTodayTasks = useCallback(async (mode: 'default' | 'replay' = 'default') => {
    setLoading(true);
    try {
      const tz = encodeURIComponent(browserTimeZone());
      const response = await fetch(`/api/home/today-tasks?tz=${tz}&mode=${mode}`, { cache: 'no-store' });
      const payload = (await response.json()) as HomeTodayTasksResponse;
      setTasks(Array.isArray(payload.tasks) ? payload.tasks : []);
      setCompletedTaskIds(Array.isArray(payload.completed_task_ids) ? payload.completed_task_ids : []);
      setPlayMode(payload.mode === 'replay' ? 'replay' : 'default');
      setIndex(0);
      setShowReward(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setPlayMode('default');
    void loadTodayTasks('default');
  }, [open, loadTodayTasks]);

  const task = tasks[index] ?? null;

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/38 p-4 backdrop-blur-sm">
      <div
        className={`${glassCard('relative flex h-[min(86vh,720px)] w-full max-w-2xl flex-col items-center justify-center bg-cover bg-center bg-no-repeat p-6 text-center shadow-[0_0_32px_rgba(255,62,165,0.2)]')}`}
        style={{ backgroundImage: "url('/Images/HomeWorld/homeplay.png?v=20260303a')" }}
      >
        {showReward && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-[#FF3EA5] opacity-70"
                style={{ left: `${(i * 17) % 100}%`, top: `${(i * 19) % 100}%`, animationDuration: `${1.1 + (i % 4) * 0.35}s` }}
              />
            ))}
          </div>
        )}

        <div className="home-play-modal-text-pulse relative z-10 flex w-full max-w-[560px] flex-col items-center justify-center px-8 py-10 text-center">
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-[#520102]">Home Play</p>
          <h3 className="mt-1 font-serif text-4xl text-[#520102]">Daily Reset</h3>

          {loading ? (
            <p className="mt-6 text-sm text-[#520102]">Loading today&apos;s tasks...</p>
          ) : task ? (
            <>
              <div className="mt-5 w-full max-w-[460px] rounded-2xl border border-white/35 bg-[#520102d9] px-5 py-4 text-white shadow-[0_0_24px_rgba(82,1,2,0.42)]">
                <p className="text-xs">Task {index + 1} / {tasks.length}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-white/85">{roomLabel(task.room)} • {task.routine_name}</p>
                <p className="mt-2 font-serif text-3xl text-white">{task.title}</p>
                <p className="mt-1 text-xs text-white/90">{task.estimated_minutes} min</p>
              </div>

              <button
                onClick={async () => {
                  if (task.is_completed) {
                    setIndex((prev) => prev + 1);
                    return;
                  }
                  setSaving(true);
                  const response = await fetch('/api/home/complete-task', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ task_id: task.id, tz: browserTimeZone() }),
                  });
                  if (response.ok) await loadTodayTasks(playMode);
                  setSaving(false);
                }}
                className="mt-7 rounded-full border border-[#FF3EA588] bg-[#FF3EA530] px-10 py-3 font-sans text-xl text-white shadow-[0_0_24px_rgba(255,62,165,0.3)] transition-all duration-200 hover:-translate-y-[1px]"
              >
                {task.is_completed ? 'Next' : saving ? 'Saving...' : 'Done'}
              </button>
            </>
          ) : (
            <div className="mt-8">
              <p className="font-serif text-3xl text-[#520102]">{showReward ? 'Home Reset Complete' : 'All done for today'}</p>
              <p className="mt-2 text-sm text-[#520102]">No pending tasks in today&apos;s routine flow.</p>
              {playMode === 'default' && completedTaskIds.length > 0 ? (
                <button
                  onClick={() => void loadTodayTasks('replay')}
                  className="mt-4 rounded-full border border-[#520102] bg-[#FFFFFF1A] px-4 py-1.5 text-xs text-[#520102] shadow-[0_0_10px_rgba(255,60,60,0.25)] transition-all duration-200 hover:-translate-y-[1px]"
                >
                  Replay Today&apos;s Routines
                </button>
              ) : null}
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-7 rounded-full border border-[#520102] bg-[#FFFFFF1A] px-4 py-1 text-xs text-[#520102] shadow-[0_0_10px_rgba(255,60,60,0.25)] transition-all duration-200 hover:-translate-y-[1px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function HomePlayBubble({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="grid flex-1 place-items-center">
      <button
        onClick={onOpen}
        className="food-bubble float-a relative flex h-[min(40vw,320px)] w-[min(40vw,320px)] max-h-[320px] max-w-[320px] flex-col items-center justify-center rounded-full border border-white/10 bg-[rgba(18,16,40,0.50)] p-6 text-center shadow-[0_0_30px_rgba(255,62,165,0.25)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_0_40px_rgba(255,62,165,0.35)]"
      >
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_28%_20%,rgba(255,255,255,0.2),transparent_54%),radial-gradient(circle_at_76%_84%,rgba(192,132,252,0.18),transparent_58%)]" />
        <span className="relative font-serif text-4xl text-[#F8F4FF]">Home Play</span>
        <span className="relative mt-2 text-sm text-[#B9B4D9]">Daily cleaning game</span>
      </button>
    </div>
  );
}

function ClosetSummaryCard({
  counts,
  onOpenManager,
  onRefresh,
}: {
  counts: ClosetCounts;
  onOpenManager: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className={glassCard('w-full max-w-[520px] p-4')}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-serif text-2xl text-[#F8F4FF]">Closet</h3>
        <button onClick={onRefresh} className="rounded-full border border-white/20 px-3 py-1 text-[11px] text-[#F8F4FF]">
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CLOSET_STATES.map((state) => (
          <div key={state} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-[#B9B4D9]">{CLOSET_STATE_LABELS[state]}</p>
            <p className="text-base text-[#F8F4FF]">{counts[state]}</p>
          </div>
        ))}
      </div>
      <button
        onClick={onOpenManager}
        className="mt-3 rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 text-xs text-[#F8F4FF]"
      >
        Open Closet Manager
      </button>
    </section>
  );
}

function ClosetManagerModal({
  open,
  onClose,
  loading,
  search,
  onSearchChange,
  itemName,
  itemSize,
  onItemSizeChange,
  onFileChange,
  fileInputKey,
  uploadingImage,
  onItemNameChange,
  onAdd,
  items,
  selectedIds,
  onToggleSelect,
  onSetItemState,
  onMoveSelected,
}: {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  itemName: string;
  itemSize: string;
  onItemSizeChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  fileInputKey: number;
  uploadingImage: boolean;
  onItemNameChange: (value: string) => void;
  onAdd: () => void;
  items: ClosetItem[];
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onSetItemState: (id: number, state: ClosetState) => void;
  onMoveSelected: (state: ClosetState) => void;
}) {
  const [mounted, setMounted] = useState(false);
  usePlatformWindowOpen(open);

  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <div className={`${glassCard('flex h-[min(86vh,760px)] w-full max-w-4xl flex-col p-4')}`}>
        <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">Closet Manager</h3>
          <button onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">Close</button>
        </div>
        <div className="grid grid-cols-[1fr_100px_1fr_auto] gap-2">
          <input value={itemName} onChange={(event) => onItemNameChange(event.target.value)} placeholder="Item name" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]" />
          <input value={itemSize} onChange={(event) => onItemSizeChange(event.target.value)} placeholder="Size" className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]" />
          <label className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]">
            <input
              key={fileInputKey}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="w-full text-[11px] text-[#B9B4D9]"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          <button onClick={onAdd} disabled={uploadingImage} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-[11px] text-[#F8F4FF] disabled:opacity-60">{uploadingImage ? 'Uploading...' : 'Add'}</button>
        </div>
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search items" className="mt-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-[#F8F4FF]" />
        <div className="mt-2 flex flex-wrap gap-1">
          {CLOSET_STATES.map((state) => (
            <button key={state} onClick={() => onMoveSelected(state)} className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-[#F8F4FF]">
              Selected → {CLOSET_STATE_LABELS[state]}
            </button>
          ))}
        </div>
        {/* Keep page no-scroll; long closet lists scroll only inside this modal panel */}
        <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-sm text-[#B9B4D9]">Loading closet...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[#B9B4D9]">No closet items yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => onToggleSelect(item.id)}
                      className="h-3.5 w-3.5 accent-[#FF3EA5]"
                    />
                    <span className="text-xs text-[#F8F4FF]">{item.name}</span>
                  </label>
                  <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-[#B9B4D9]">{CLOSET_STATE_LABELS[item.state]}</span>
                </div>
                <p className="mt-1 text-[10px] text-[#B9B4D9]">{item.category ?? 'General'}</p>
                <p className="mt-0.5 text-[10px] text-[#B9B4D9]">{item.size ? `Size: ${item.size}` : 'Size: -'}</p>
                {item.image_path ? (
                  <img src={item.image_path} alt={item.name} className="mt-1 h-12 w-12 rounded-lg border border-white/10 object-cover" />
                ) : null}
                <div className="mt-1 flex flex-wrap gap-1">
                  {CLOSET_STATES.map((state) => (
                    <button
                      key={`${item.id}-${state}`}
                      onClick={() => onSetItemState(item.id, state)}
                      className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        item.state === state ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'
                      }`}
                    >
                      {CLOSET_STATE_LABELS[state]}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function HomeWorld() {
  const [openRoutineModal, setOpenRoutineModal] = useState(false);
  const [openHomePlay, setOpenHomePlay] = useState(false);
  const [openClosetManager, setOpenClosetManager] = useState(false);
  const [closetData, setClosetData] = useState<ClosetResponse | null>(null);
  const [closetLoading, setClosetLoading] = useState(true);
  const [closetSearch, setClosetSearch] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemSize, setNewItemSize] = useState('');
  const [newItemFile, setNewItemFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploadingClosetImage, setUploadingClosetImage] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);

  const loadCloset = useCallback(async () => {
    setClosetLoading(true);
    try {
      const response = await fetch('/api/home/closet', { cache: 'no-store' });
      const payload = (await response.json()) as ClosetResponse;
      setClosetData({
        items: Array.isArray(payload.items) ? payload.items : [],
        counts: payload.counts ?? {
          in_closet: 0,
          dirty: 0,
          in_laundry: 0,
          drying: 0,
          folded: 0,
        },
      });
    } finally {
      setClosetLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCloset();
  }, [loadCloset]);

  const filteredClosetItems = useMemo(() => {
    const items = closetData?.items ?? [];
    const query = closetSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const haystack = `${item.name} ${item.size ?? ''} ${item.category ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [closetData, closetSearch]);

  const toggleItemSelection = (id: number) => {
    setSelectedItemIds((prev) => (prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]));
  };

  const updateSingleItemState = async (id: number, state: ClosetState) => {
    await fetch(`/api/home/closet/${id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
    await loadCloset();
  };

  const moveSelectedItemsTo = async (state: ClosetState) => {
    if (selectedItemIds.length === 0) return;
    await fetch('/api/home/closet/bulk-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: selectedItemIds, to_state: state }),
    });
    setSelectedItemIds([]);
    await loadCloset();
  };

  const addClosetItem = async () => {
    if (!newItemName.trim()) return;
    let imagePath: string | null = null;
    if (newItemFile) {
      setUploadingClosetImage(true);
      const formData = new FormData();
      formData.append('file', newItemFile);
      const uploadResponse = await fetch('/api/home/closet/upload-image', {
        method: 'POST',
        body: formData,
      });
      const uploadPayload = (await uploadResponse.json()) as { image_path?: string };
      imagePath = typeof uploadPayload.image_path === 'string' ? uploadPayload.image_path : null;
      setUploadingClosetImage(false);
    }

    await fetch('/api/home/closet/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newItemName.trim(),
        size: newItemSize.trim() || null,
        image_path: imagePath,
      }),
    });
    setNewItemName('');
    setNewItemSize('');
    setNewItemFile(null);
    setFileInputKey((value) => value + 1);
    await loadCloset();
  };

  const closetCounts: ClosetCounts = closetData?.counts ?? {
    in_closet: 0,
    dirty: 0,
    in_laundry: 0,
    drying: 0,
    folded: 0,
  };

  return (
    <BackgroundShell overlayClassName="bg-[radial-gradient(circle_at_50%_36%,rgba(255,62,165,0.14),rgba(192,132,252,0.08)_48%,rgba(8,6,24,0.84)_74%)]">
      {/* Keep page-level no-scroll; lists and dense controls are moved into modals */}
      <div className="mx-auto flex h-full w-full max-w-[1320px] flex-col gap-4 overflow-hidden px-5 py-4 md:px-8">
        <header className={glassCard('flex items-center justify-between px-4 py-2')}>
          <Link href="/" className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[#B9B4D9]">
            ← Back
          </Link>
          <div className="flex-1" />
          <button
            onClick={() => setOpenRoutineModal(true)}
            className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-[#F8F4FF]"
          >
            Routine System
          </button>
        </header>

        <section className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-hidden">
          <div className="grid min-h-0 place-items-center overflow-hidden -mt-6 max-[900px]:-mt-3">
            <HomePlayBubble onOpen={() => setOpenHomePlay(true)} />
          </div>
          <div className="grid min-h-0 content-start justify-items-end gap-4 overflow-hidden pt-8">
            <div className="w-full max-w-[760px]">
              <ClosetPortals />
            </div>
            <div className="w-full max-w-[760px]">
              <div className="flex justify-center">
                <PlantSticker sizeClass="h-40 w-40 max-h-40 max-w-40" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <RoutineSystemModal open={openRoutineModal} onClose={() => setOpenRoutineModal(false)} />
      <HomePlayOverlay open={openHomePlay} onClose={() => setOpenHomePlay(false)} />
    </BackgroundShell>
  );
}
