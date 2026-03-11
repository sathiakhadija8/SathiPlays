'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CYCLE_SYMPTOM_GROUPS, type BleedingType } from '../../lib/cycle-constants';
import { dotState, formatDayLabel, formatHHMM } from '../../lib/cycle-helpers';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

export type CycleSummaryResponse = {
  days: Array<{
    day: string;
    has_logs: boolean;
    has_symptoms: boolean;
    has_period: boolean;
    has_bc: boolean;
  }>;
  latest_log: {
    created_at: string;
    logged_for_date: string;
    bleeding_type: BleedingType;
    birth_control_taken: boolean;
    symptoms: string[];
  } | null;
  today_has_logs: boolean;
  today_logs_count: number;
  top_symptoms_30d?: string[];
};

export type CycleDayLog = {
  id: number;
  created_at: string;
  symptoms: string[];
  bleeding_type: BleedingType;
  birth_control_taken: boolean;
  note: string | null;
};

type CycleModalProps = {
  open: boolean;
  initialTab?: 'log' | 'today' | 'history';
  initialDate?: string | null;
  summary: CycleSummaryResponse | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const TABS = ['log', 'today', 'history'] as const;
type Tab = (typeof TABS)[number];
const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function dotClasses(state: ReturnType<typeof dotState>) {
  if (state === 'period') return 'bg-[#FF3EA5] shadow-[0_0_10px_rgba(255,62,165,0.7)]';
  if (state === 'bc') return 'bg-[#C084FC] shadow-[0_0_9px_rgba(192,132,252,0.58)]';
  if (state === 'symptoms') return 'bg-[#FF8BC8] shadow-[0_0_7px_rgba(255,139,200,0.45)]';
  return 'bg-white/20';
}

function monthDateFromYmd(value: string | null): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function buildMonthCells(viewDate: Date): Array<{ day: string | null; date: number | null }> {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekdayMonday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: string | null; date: number | null }> = [];
  for (let i = 0; i < firstWeekdayMonday; i += 1) cells.push({ day: null, date: null });

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      date: day,
    });
  }

  const minimumSize = cells.length <= 35 ? 35 : 42;
  while (cells.length < minimumSize) cells.push({ day: null, date: null });
  return cells;
}

export function CycleModal({ open, initialTab = 'log', initialDate = null, summary, onClose, onSaved }: CycleModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [bleedingType, setBleedingType] = useState<BleedingType>('none');
  const [birthControl, setBirthControl] = useState(false);
  const [note, setNote] = useState('');
  const [todayLogs, setTodayLogs] = useState<CycleDayLog[]>([]);
  const [historyLogs, setHistoryLogs] = useState<CycleDayLog[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePlatformWindowOpen(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setSelectedDate(initialDate ?? summary?.days[summary.days.length - 1]?.day ?? null);
  }, [open, initialTab, initialDate, summary]);

  useEffect(() => {
    if (!open || tab !== 'today') return;

    const fetchToday = async () => {
      setLoadingToday(true);
      try {
        const response = await fetch('/api/cycle/today', { cache: 'no-store' });
        const payload = (await response.json()) as CycleDayLog[];
        setTodayLogs(Array.isArray(payload) ? payload : []);
      } catch {
        setTodayLogs([]);
      } finally {
        setLoadingToday(false);
      }
    };

    fetchToday();
  }, [open, tab, savedFlash]);

  useEffect(() => {
    if (!open || tab !== 'history' || !selectedDate) return;

    const fetchDay = async () => {
      setLoadingHistory(true);
      try {
        const response = await fetch(`/api/cycle/day?date=${selectedDate}`, { cache: 'no-store' });
        const payload = (await response.json()) as CycleDayLog[];
        setHistoryLogs(Array.isArray(payload) ? payload : []);
      } catch {
        setHistoryLogs([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchDay();
  }, [open, tab, selectedDate, savedFlash]);

  const onToggleSymptom = (value: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value],
    );
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/cycle/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: selectedSymptoms,
          bleeding_type: bleedingType,
          birth_control_taken: birthControl,
          note: note.trim() ? note.trim() : undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? 'Save failed.');
      }

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1300);
      setNote('');
      setSelectedSymptoms([]);
      setBleedingType('none');
      setBirthControl(false);
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save log.');
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const days = summary?.days ?? [];
    const daysLogged = days.filter((day) => day.has_logs).length;
    const periodDays = days.filter((day) => day.has_period).length;
    const bcDays = days.filter((day) => day.has_bc).length;
    const topSymptoms = summary?.top_symptoms_30d ?? [];

    return { daysLogged, periodDays, bcDays, topSymptoms };
  }, [summary]);

  const historyMonth = useMemo(() => {
    const fallback = summary?.days?.[summary.days.length - 1]?.day ?? null;
    return monthDateFromYmd(selectedDate ?? fallback);
  }, [selectedDate, summary]);

  const monthLabel = useMemo(
    () => historyMonth.toLocaleDateString([], { month: 'long', year: 'numeric' }),
    [historyMonth],
  );

  const monthCells = useMemo(() => buildMonthCells(historyMonth), [historyMonth]);
  const statusMap = useMemo(() => new Map((summary?.days ?? []).map((day) => [day.day, day])), [summary]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="glass-depth-main flex h-[min(88vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_36px_rgba(255,62,165,0.2)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">Cycle Window</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/15 px-3 py-1 text-sm text-[#F8F4FF] hover:bg-white/10">
            Close
          </button>
        </div>

        <div className="flex gap-2 px-4 py-3">
          {TABS.map((tabValue) => (
            <button
              key={tabValue}
              type="button"
              onClick={() => setTab(tabValue)}
              className={`rounded-full border px-3 py-1 font-sans text-xs uppercase tracking-wide transition-all duration-300 hover:-translate-y-[1px] ${
                tab === tabValue
                  ? 'border-[#FF3EA560] bg-[#FF3EA522] text-[#F8F4FF]'
                  : 'border-white/10 bg-white/5 text-[#B9B4D9]'
              }`}
            >
              {tabValue}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'log' && (
            <div className="space-y-4">
              {Object.entries(CYCLE_SYMPTOM_GROUPS).map(([group, tags]) => (
                <section key={group} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <h4 className="font-serif text-lg text-[#F8F4FF]">{group}</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const active = selectedSymptoms.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => onToggleSymptom(tag)}
                          className={`rounded-full border px-3 py-1 font-sans text-xs transition-all duration-300 hover:-translate-y-[1px] ${
                            active
                              ? 'border-[#FF3EA560] bg-[#FF3EA522] text-[#F8F4FF]'
                              : 'border-white/10 bg-white/5 text-[#B9B4D9]'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <h4 className="font-serif text-lg text-[#F8F4FF]">Bleeding</h4>
                <div className="mt-2 flex gap-2">
                  {(['none', 'spotting', 'period'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBleedingType(value)}
                      className={`rounded-full border px-3 py-1 font-sans text-xs transition-all duration-300 hover:-translate-y-[1px] ${
                        bleedingType === value
                          ? 'border-[#FF3EA560] bg-[#FF3EA522] text-[#F8F4FF]'
                          : 'border-white/10 bg-white/5 text-[#B9B4D9]'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>

                <label className="mt-3 flex items-center gap-2 font-sans text-sm text-[#F8F4FF]">
                  <input
                    type="checkbox"
                    checked={birthControl}
                    onChange={(event) => setBirthControl(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-black/30 accent-[#C084FC]"
                  />
                  Birth control taken today
                </label>

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 200))}
                  placeholder="Optional note"
                  className="mt-3 h-20 w-full rounded-xl border border-white/10 bg-black/20 p-2 font-sans text-sm text-[#F8F4FF] placeholder:text-[#B9B4D9]"
                />

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saving}
                    className={`rounded-full border border-[#FF3EA560] bg-[#FF3EA51A] px-4 py-1.5 font-sans text-xs text-[#F8F4FF] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#FF3EA533] ${savedFlash ? 'animate-log-glow' : ''}`}
                  >
                    {saving ? 'Saving...' : 'Save log'}
                  </button>
                  <span className={`font-sans text-xs text-[#FF86C8] transition-opacity duration-500 ${savedFlash ? 'opacity-100' : 'opacity-0'}`}>
                    Saved ✓
                  </span>
                  {error && <span className="font-sans text-xs text-[#FF86C8]">{error}</span>}
                </div>
              </section>
            </div>
          )}

          {tab === 'today' && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <h4 className="font-serif text-lg text-[#F8F4FF]">Today&apos;s Logs</h4>
              {loadingToday ? (
                <div className="mt-3 shimmer h-20 rounded-xl bg-white/10" />
              ) : todayLogs.length === 0 ? (
                <p className="mt-3 font-sans text-sm text-[#B9B4D9]">No logs for today yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {todayLogs.map((log) => (
                    <li key={log.id} className="rounded-xl border border-white/10 bg-black/25 p-2">
                      <p className="font-sans text-xs text-[#B9B4D9]">{formatHHMM(log.created_at)}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {log.symptoms.map((symptom) => (
                          <span key={symptom} className="rounded-full bg-white/10 px-2 py-0.5 font-sans text-[11px] text-[#F8F4FF]">{symptom}</span>
                        ))}
                        {log.bleeding_type !== 'none' && (
                          <span className="rounded-full bg-[#FF3EA522] px-2 py-0.5 font-sans text-[11px] text-[#F8F4FF]">{log.bleeding_type}</span>
                        )}
                        {log.birth_control_taken && (
                          <span className="rounded-full bg-[#C084FC22] px-2 py-0.5 font-sans text-[11px] text-[#F8F4FF]">BC taken</span>
                        )}
                      </div>
                      {log.note && <p className="mt-1 font-sans text-xs text-[#B9B4D9]">{log.note}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="font-serif text-lg text-[#F8F4FF]">Calendar</h4>
                  <p className="font-sans text-xs text-[#B9B4D9]">{monthLabel}</p>
                </div>
                <div className="mb-1 grid grid-cols-7 gap-1">
                  {WEEK_LABELS.map((label, index) => (
                    <span key={`${label}-${index}`} className="text-center font-sans text-[10px] text-[#CFC6E7]">
                      {label}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {monthCells.map((cell, index) => {
                    if (!cell.day || !cell.date) {
                      return <span key={`empty-${index}`} className="h-8 rounded-md bg-white/[0.02]" aria-hidden />;
                    }
                    const daySummary = statusMap.get(cell.day);
                    const state = daySummary ? dotState(daySummary) : 'none';
                    const selected = selectedDate === cell.day;
                    const hasLog = Boolean(daySummary?.has_logs);
                    return (
                      <button
                        key={cell.day}
                        type="button"
                        onClick={() => setSelectedDate(cell.day)}
                        className={`relative h-8 rounded-md border text-center font-sans text-[11px] transition-all duration-200 hover:-translate-y-[1px] ${
                          selected
                            ? 'border-[#FFD8EE88] bg-[#FFD8EE22] text-[#F8F4FF]'
                            : 'border-white/10 bg-white/[0.04] text-[#D5CCE9]'
                        }`}
                        aria-label={cell.day}
                        title={cell.day}
                      >
                        {cell.date}
                        {hasLog ? (
                          <span className={`absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${dotClasses(state)}`} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 font-sans text-xs text-[#F8F4FF] md:grid-cols-4">
                <div><p className="text-[#B9B4D9]">Days logged (30D)</p><p>{stats.daysLogged}</p></div>
                <div><p className="text-[#B9B4D9]">Period days (30D)</p><p>{stats.periodDays}</p></div>
                <div><p className="text-[#B9B4D9]">BC days (30D)</p><p>{stats.bcDays}</p></div>
                <div><p className="text-[#B9B4D9]">Top symptoms</p><p>{stats.topSymptoms.join(', ') || '--'}</p></div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <h5 className="font-serif text-base text-[#F8F4FF]">{selectedDate ? formatDayLabel(selectedDate) : 'Select a day'}</h5>
                {loadingHistory ? (
                  <div className="mt-3 shimmer h-20 rounded-xl bg-white/10" />
                ) : historyLogs.length === 0 ? (
                  <p className="mt-3 font-sans text-sm text-[#B9B4D9]">No logs for this day.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {historyLogs.map((log) => (
                      <li key={log.id} className="rounded-xl border border-white/10 bg-black/25 p-2">
                        <p className="font-sans text-xs text-[#B9B4D9]">{formatHHMM(log.created_at)}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {log.symptoms.map((symptom) => (
                            <span key={symptom} className="rounded-full bg-white/10 px-2 py-0.5 font-sans text-[11px] text-[#F8F4FF]">{symptom}</span>
                          ))}
                          {log.bleeding_type !== 'none' && (
                            <span className="rounded-full bg-[#FF3EA522] px-2 py-0.5 font-sans text-[11px] text-[#F8F4FF]">{log.bleeding_type}</span>
                          )}
                          {log.birth_control_taken && (
                            <span className="rounded-full bg-[#C084FC22] px-2 py-0.5 font-sans text-[11px] text-[#F8F4FF]">BC taken</span>
                          )}
                        </div>
                        {log.note && <p className="mt-1 font-sans text-xs text-[#B9B4D9]">{log.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
