'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

type TeaType = {
  id: number;
  name: string;
  is_active: number;
};

type TeaLog = {
  id: number;
  tea_type_id: number;
  tea_name: string;
  logged_at: string;
  moods: string[];
  notes: string | null;
};

type Payload = {
  date: string;
  tea_types: TeaType[];
  today_logs: TeaLog[];
};

const MOODS = ['Bloated', 'Anxious', 'Low Energy', 'Cravings', 'PMS', 'Headache', 'Calm', 'Focus'] as const;

const MOOD_SUGGESTIONS: Record<string, string[]> = {
  Bloated: ['Ginger Tea', 'Green Tea', 'Spearmint'],
  Anxious: ['Chamomile', 'Spearmint', 'Chai'],
  'Low Energy': ['Green Tea', 'Chai', 'Ginger Tea'],
  Cravings: ['Chai', 'Spearmint', 'Green Tea'],
  PMS: ['Chamomile', 'Ginger Tea', 'Spearmint'],
  Headache: ['Chamomile', 'Ginger Tea', 'Green Tea'],
  Calm: ['Green Tea', 'Spearmint', 'Chamomile'],
  Focus: ['Green Tea', 'Chai', 'Spearmint'],
};

function asDatetimeLocalValue(input: string) {
  const date = new Date(input.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function formatTime(input: string) {
  const date = new Date(input.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function TeaCheckInModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [teaTypes, setTeaTypes] = useState<TeaType[]>([]);
  const [todayLogs, setTodayLogs] = useState<TeaLog[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedTeaTypeId, setSelectedTeaTypeId] = useState<number | null>(null);
  const [useManualTime, setUseManualTime] = useState(false);
  const [manualTime, setManualTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePlatformWindowOpen(open);
  useEffect(() => setMounted(true), []);

  const load = async () => {
    setError(null);
    const response = await fetch('/api/glow/tea/checkin', { cache: 'no-store' });
    if (!response.ok) {
      setTeaTypes([]);
      setTodayLogs([]);
      return;
    }
    const payload = (await response.json()) as Payload;
    const nextTypes = Array.isArray(payload.tea_types) ? payload.tea_types : [];
    setTeaTypes(nextTypes);
    setTodayLogs(Array.isArray(payload.today_logs) ? payload.today_logs : []);
    if (nextTypes.length > 0) {
      setSelectedTeaTypeId((prev) => {
        if (prev && nextTypes.some((item) => item.id === prev)) return prev;
        return nextTypes[0].id;
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    setUseManualTime(false);
    setManualTime('');
    setNotes('');
    setSelectedMoods([]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedTeaNames = useMemo(() => {
    const ranked = new Map<string, number>();
    for (const mood of selectedMoods) {
      for (const tea of MOOD_SUGGESTIONS[mood] ?? []) {
        ranked.set(tea, (ranked.get(tea) ?? 0) + 1);
      }
    }

    const names = Array.from(ranked.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);

    if (names.length >= 3) return names.slice(0, 3);

    const fallback = teaTypes.map((item) => item.name);
    for (const name of fallback) {
      if (!names.includes(name)) names.push(name);
      if (names.length >= 3) break;
    }

    return names.slice(0, 3);
  }, [selectedMoods, teaTypes]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!selectedTeaTypeId) {
      setError('Please choose a tea type.');
      return;
    }

    setSaving(true);
    const response = await fetch('/api/glow/tea/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tea_type_id: selectedTeaTypeId,
        logged_at: useManualTime && manualTime ? manualTime : undefined,
        moods: selectedMoods,
        notes: notes.trim() || null,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setError(payload.message ?? 'Unable to save tea log.');
      setSaving(false);
      return;
    }

    const payload = (await response.json()) as Payload & { ok: boolean };
    setTeaTypes(Array.isArray(payload.tea_types) ? payload.tea_types : []);
    setTodayLogs(Array.isArray(payload.today_logs) ? payload.today_logs : []);
    setUseManualTime(false);
    setManualTime('');
    setNotes('');
    setSaving(false);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.72)] p-4 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">Tea Check-In</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">Close</button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <section>
            <p className="mb-2 font-sans text-xs uppercase tracking-[0.16em] text-[#CFC9F0]">How are you feeling? (optional)</p>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((mood) => {
                const selected = selectedMoods.includes(mood);
                return (
                  <button
                    key={mood}
                    type="button"
                    onClick={() =>
                      setSelectedMoods((prev) =>
                        prev.includes(mood) ? prev.filter((item) => item !== mood) : [...prev, mood],
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      selected ? 'border-[#FF3EA5] bg-[#FF3EA5] text-white' : 'border-white/25 bg-transparent text-[#F8F4FF]'
                    }`}
                  >
                    {mood}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <p className="mb-2 font-sans text-xs uppercase tracking-[0.16em] text-[#CFC9F0]">Suggested Teas</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedTeaNames.map((name) => {
                const match = teaTypes.find((item) => item.name === name);
                const selected = match ? selectedTeaTypeId === match.id : false;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      if (match) setSelectedTeaTypeId(match.id);
                    }}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      selected ? 'border-[#FF3EA5] bg-[#FF3EA5] text-white' : 'border-white/25 bg-transparent text-[#F8F4FF]'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </section>

          <form className="rounded-xl border border-white/10 bg-black/20 p-3" onSubmit={submit}>
            <p className="mb-2 font-sans text-xs uppercase tracking-[0.16em] text-[#CFC9F0]">Log Tea</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <select
                value={selectedTeaTypeId ?? ''}
                onChange={(event) => setSelectedTeaTypeId(Number(event.target.value) || null)}
                className="h-9 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-[#F8F4FF]"
              >
                {teaTypes.map((tea) => (
                  <option key={tea.id} value={tea.id}>{tea.name}</option>
                ))}
              </select>

              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-[#F8F4FF]">
                <input
                  type="checkbox"
                  checked={useManualTime}
                  onChange={(event) => setUseManualTime(event.target.checked)}
                />
                Manual time
              </label>

              {useManualTime ? (
                <input
                  type="datetime-local"
                  value={manualTime}
                  max={asDatetimeLocalValue(new Date().toISOString())}
                  onChange={(event) => setManualTime(event.target.value)}
                  className="md:col-span-2 h-9 rounded-xl border border-white/10 bg-black/25 px-3 text-xs text-[#F8F4FF]"
                />
              ) : (
                <div className="md:col-span-2 h-9 rounded-xl border border-white/10 bg-black/10 px-3 text-xs text-[#B9B4D9] flex items-center">
                  Time will be saved as now
                </div>
              )}

              <textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notes (optional)"
                className="md:col-span-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-[#F8F4FF]"
              />
            </div>

            {error && <p className="mt-2 text-xs text-[#ff9acb]">{error}</p>}

            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1.5 text-xs text-[#F8F4FF]"
              >
                {saving ? 'Saving...' : 'Save log'}
              </button>
            </div>
          </form>

          <section>
            <p className="mb-2 font-sans text-xs uppercase tracking-[0.16em] text-[#CFC9F0]">Today&apos;s Tea Logs</p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {todayLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-1.5">
                  <p className="font-sans text-xs text-[#F8F4FF]">{formatTime(log.logged_at)} • {log.tea_name}</p>
                  {log.moods.length > 0 && <p className="text-[11px] text-[#D7D3F1]">{log.moods.join(', ')}</p>}
                </div>
              ))}
              {todayLogs.length === 0 && <p className="font-sans text-xs text-[#B9B4D9]">No tea logs yet today.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
