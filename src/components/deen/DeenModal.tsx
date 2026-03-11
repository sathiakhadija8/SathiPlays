'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr prayed',
  dhuhr: 'Dhuhr prayed',
  asr: 'Asr prayed',
  maghrib: 'Maghrib prayed',
  isha: 'Isha prayed',
  tahajjud: 'Tahajjud prayed',
};

const LEARNING_PRESETS = [20, 30, 45, 60];
const DHIKR_TYPES = ['SubhanAllah', 'Alhamdulillah', 'Allahu Akbar', 'Salawat', 'Istighfar'];
const REFLECTION_QUESTIONS = [
  'Who was I today in front of Allah?',
  'When was I emotionally triggered?',
  'Did I act from sincerity or ego?',
  'What quiet blessing did I overlook?',
  'If I could redo one moment?',
  'What does my heart need right now?',
];

type Dashboard = {
  date: string;
  learning_minutes_today: number;
  dhikr_counts: Record<string, number>;
  salah_done: Array<{ key: string; done: boolean }>;
  next_salah: string | null;
  salah_completed: boolean;
  quran: { pages_read: number; daily_goal: number; mushaf_version: string };
};

export function DeenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<Dashboard | null>(null);

  const [learningPreset, setLearningPreset] = useState(30);
  const [learningRunning, setLearningRunning] = useState(false);
  const [learningFocus, setLearningFocus] = useState(false);
  const [learningStartedAt, setLearningStartedAt] = useState<number | null>(null);
  const [learningSecondsLeft, setLearningSecondsLeft] = useState(0);

  const [quranEditOpen, setQuranEditOpen] = useState(false);
  const [quranDraft, setQuranDraft] = useState({ pages_read: '0', daily_goal: '5', mushaf_version: 'Standard' });

  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionSaving, setReflectionSaving] = useState(false);
  const [reflectionAnswers, setReflectionAnswers] = useState<Record<string, string>>({
    q1: '', q2: '', q3: '', q4: '', q5: '', q6: '',
  });
  usePlatformWindowOpen(open);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (reflectionOpen) {
          setReflectionOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, reflectionOpen]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/deen/dashboard', { cache: 'no-store' });
      const payload = (await response.json()) as Dashboard & { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Unable to load Deen data.');
      setData(payload);
      setQuranDraft({
        pages_read: String(payload.quran.pages_read ?? 0),
        daily_goal: String(payload.quran.daily_goal ?? 5),
        mushaf_version: payload.quran.mushaf_version || 'Standard',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Deen data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadDashboard();
  }, [open]);

  useEffect(() => {
    if (open) return;
    setLearningFocus(false);
    setLearningRunning(false);
    setLearningStartedAt(null);
    setLearningSecondsLeft(0);
  }, [open]);

  useEffect(() => {
    if (!learningRunning) return;
    const interval = window.setInterval(() => {
      setLearningSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [learningRunning]);

  useEffect(() => {
    if (!learningRunning) return;
    if (learningSecondsLeft > 0) return;
    void stopLearningSession();
  }, [learningSecondsLeft]);

  const startLearningSession = () => {
    const seconds = learningPreset * 60;
    setLearningFocus(true);
    setLearningRunning(true);
    setLearningStartedAt(Date.now());
    setLearningSecondsLeft(seconds);
  };

  const stopLearningSession = async () => {
    if (!learningRunning || learningStartedAt === null) return;
    const elapsedSec = Math.max(60, Math.floor((Date.now() - learningStartedAt) / 1000));
    const actualMinutes = Math.max(1, Math.round(elapsedSec / 60));

    setLearningRunning(false);
    setLearningFocus(false);
    setLearningStartedAt(null);
    setLearningSecondsLeft(0);

    try {
      await fetch('/api/deen/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planned_minutes: learningPreset,
          actual_minutes: actualMinutes,
          started_at: new Date(Date.now() - elapsedSec * 1000).toISOString(),
          ended_at: new Date().toISOString(),
        }),
      });
      await loadDashboard();
    } catch {
      // keep silent and let next refresh recover
    }
  };

  const logDhikr = async (dhikrType: string) => {
    try {
      await fetch('/api/deen/dhikr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dhikr_type: dhikrType }),
      });
      await loadDashboard();
    } catch {
      setError('Unable to log dhikr right now.');
    }
  };

  const markNextSalah = async () => {
    if (!data?.next_salah) return;
    try {
      await fetch('/api/deen/salah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prayer_key: data.next_salah }),
      });
      await loadDashboard();
    } catch {
      setError('Unable to update salah right now.');
    }
  };

  const incrementQuran = async () => {
    try {
      await fetch('/api/deen/quran/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: 1 }),
      });
      await loadDashboard();
    } catch {
      setError('Unable to update Quran progress.');
    }
  };

  const saveQuranSettings = async () => {
    try {
      await fetch('/api/deen/quran/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages_read: Number(quranDraft.pages_read || 0),
          daily_goal: Number(quranDraft.daily_goal || 5),
          mushaf_version: quranDraft.mushaf_version,
        }),
      });
      setQuranEditOpen(false);
      await loadDashboard();
    } catch {
      setError('Unable to save Quran settings.');
    }
  };

  const openReflection = async () => {
    setReflectionOpen(true);
    setReflectionLoading(true);
    try {
      const response = await fetch('/api/deen/reflection', { cache: 'no-store' });
      const payload = (await response.json()) as { answers?: Record<string, string> };
      setReflectionAnswers({
        q1: payload.answers?.q1 ?? '',
        q2: payload.answers?.q2 ?? '',
        q3: payload.answers?.q3 ?? '',
        q4: payload.answers?.q4 ?? '',
        q5: payload.answers?.q5 ?? '',
        q6: payload.answers?.q6 ?? '',
      });
    } catch {
      setError('Unable to load reflection.');
    } finally {
      setReflectionLoading(false);
    }
  };

  const saveReflection = async () => {
    setReflectionSaving(true);
    try {
      await fetch('/api/deen/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: reflectionAnswers }),
      });
      setReflectionOpen(false);
    } catch {
      setError('Unable to save reflection.');
    } finally {
      setReflectionSaving(false);
    }
  };

  const quranPercent = useMemo(() => {
    const pages = Number(data?.quran.pages_read ?? 0);
    const goal = Math.max(1, Number(data?.quran.daily_goal ?? 1));
    return Math.max(0, Math.min(100, Math.round((pages / goal) * 100)));
  }, [data?.quran.pages_read, data?.quran.daily_goal]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (!panelRef.current) return;
        if (panelRef.current.contains(event.target as Node)) return;
        if (reflectionOpen) return;
        onClose();
      }}
    >
      <div
        ref={panelRef}
        className="finance-modal-enter flex h-[min(90vh,820px)] w-[min(96vw,980px)] flex-col overflow-hidden rounded-2xl border border-[#f6f1d822] bg-cover bg-center bg-no-repeat p-5 shadow-[0_0_36px_rgba(215,183,120,0.18)]"
        style={{ backgroundImage: "linear-gradient(180deg,rgba(10,18,34,0.80),rgba(12,22,38,0.82)), url('/Images/deenbackground.png')" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-3xl text-[#F8F4FF]">🕌 Deen</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading && <div className="h-28 animate-pulse rounded-xl bg-white/5" />}
          {!loading && data && (
            learningFocus ? (
              <div className="grid min-h-[58vh] place-items-center">
              <section className="w-full max-w-2xl rounded-3xl border border-[#d7b7784d] bg-[linear-gradient(160deg,rgba(215,183,120,0.24),rgba(10,18,34,0.9)_45%)] p-6 text-center shadow-[0_0_30px_rgba(215,183,120,0.24)]">
                <p className="text-xs uppercase tracking-[0.14em] text-[#B9D8F2]">Learning Session</p>
                <p className="mt-2 text-4xl text-[#FFF7FB]">{data.learning_minutes_today} min</p>
                <p className="text-sm text-[#B9B4D9]">studied today</p>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {LEARNING_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLearningPreset(preset)}
                      className={`rounded-full border px-3 py-1 text-xs ${learningPreset === preset ? 'border-[#d7b778] bg-[#d7b77822] text-[#FFF7FB]' : 'border-white/20 text-[#B9B4D9]'}`}
                    >
                      {preset === 60 ? '1h' : `${preset}m`}
                    </button>
                  ))}
                </div>

                <p className="mt-5 text-5xl font-serif text-[#F8F4FF]">
                  {Math.floor(learningSecondsLeft / 60)}:{String(learningSecondsLeft % 60).padStart(2, '0')}
                </p>

                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => void stopLearningSession()}
                    className="rounded-full border border-[#d96a6a66] bg-[#d96a6a22] px-5 py-2 text-sm text-[#FFF7FB]"
                  >
                    Stop & Save
                  </button>
                </div>
              </section>
              </div>
            ) : (
            <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-[780px]:grid-cols-1">
              <section className="rounded-2xl border border-[#f6f1d824] bg-[rgba(11,20,33,0.72)] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[#B9D8F2]">Learning Session</p>
                <p className="mt-1 text-2xl text-[#FFF7FB]">{data.learning_minutes_today} min</p>
                <p className="text-xs text-[#B9B4D9]">studied today</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LEARNING_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLearningPreset(preset)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${learningPreset === preset ? 'border-[#d7b778] bg-[#d7b77822] text-[#FFF7FB]' : 'border-white/20 text-[#B9B4D9]'}`}
                    >
                      {preset === 60 ? '1h' : `${preset}m`}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {!learningRunning ? (
                    <button type="button" onClick={startLearningSession} className="rounded-full border border-[#d7b77866] bg-[#d7b77822] px-3 py-1.5 text-xs text-[#FFF7FB]">▶ Start</button>
                  ) : (
                    <button type="button" onClick={() => void stopLearningSession()} className="rounded-full border border-[#d96a6a66] bg-[#d96a6a22] px-3 py-1.5 text-xs text-[#FFF7FB]">Stop</button>
                  )}
                  {learningRunning && (
                    <p className="text-xs text-[#E9E3F2]">{Math.floor(learningSecondsLeft / 60)}:{String(learningSecondsLeft % 60).padStart(2, '0')}</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[#f6f1d824] bg-[rgba(11,20,33,0.72)] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[#B9D8F2]">Dhikr</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DHIKR_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => void logDhikr(type)}
                      className="rounded-xl border border-white/15 bg-[rgba(255,247,251,0.06)] px-2 py-1.5 text-xs text-[#FFF7FB] transition hover:border-[#d7b77866] hover:shadow-[0_0_14px_rgba(215,183,120,0.2)]"
                    >
                      {type} +
                      <span className="ml-1 text-[#B9B4D9]">{data.dhikr_counts[type] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <section className="mx-auto w-full max-w-xl rounded-2xl border border-[#d7b7783b] bg-[linear-gradient(160deg,rgba(215,183,120,0.16),rgba(10,18,34,0.82)_42%)] p-4 text-center shadow-[0_0_22px_rgba(215,183,120,0.18)]">
              <p className="text-xs uppercase tracking-[0.12em] text-[#E8EAF6]">Salah</p>
              {!data.salah_completed && data.next_salah ? (
                <button
                  type="button"
                  onClick={() => void markNextSalah()}
                  className="mt-3 rounded-full border border-[#d7b77866] bg-[#d7b77822] px-6 py-2 text-sm text-[#FFF7FB] transition hover:scale-[1.01]"
                >
                  {PRAYER_LABELS[data.next_salah] ?? 'Next salah'}
                </button>
              ) : (
                <p className="mt-3 text-sm text-[#FFF7FB]">All prayers completed today ✨</p>
              )}
            </section>

            <div className="grid grid-cols-2 gap-4 max-[780px]:grid-cols-1">
              <section className="rounded-2xl border border-[#f6f1d824] bg-[rgba(11,20,33,0.72)] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#B9D8F2]">Quran Progress</p>
                  <button type="button" onClick={() => setQuranEditOpen((v) => !v)} className="text-sm text-[#d7b778]">📖</button>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="relative h-16 w-16">
                    <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        stroke="#d7b778"
                        strokeWidth="6"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - quranPercent / 100)}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 240ms ease' }}
                      />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center text-xs text-[#FFF7FB]">{quranPercent}%</span>
                  </div>
                  <div>
                    <p className="text-sm text-[#FFF7FB]">{data.quran.pages_read}/{data.quran.daily_goal} pages</p>
                    <p className="text-xs text-[#B9B4D9]">{data.quran.mushaf_version}</p>
                  </div>
                </div>
                <button type="button" onClick={() => void incrementQuran()} className="mt-3 rounded-full border border-[#d7b77866] bg-[#d7b77822] px-3 py-1 text-xs text-[#FFF7FB]">+1 page</button>

                {quranEditOpen && (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                    <label className="text-[11px] text-[#B9B4D9]">
                      Pages
                      <input className="mt-1 h-8 w-full rounded border border-white/10 bg-black/30 px-2 text-xs text-[#FFF7FB]" value={quranDraft.pages_read} onChange={(e) => setQuranDraft((p) => ({ ...p, pages_read: e.target.value }))} />
                    </label>
                    <label className="text-[11px] text-[#B9B4D9]">
                      Goal
                      <input className="mt-1 h-8 w-full rounded border border-white/10 bg-black/30 px-2 text-xs text-[#FFF7FB]" value={quranDraft.daily_goal} onChange={(e) => setQuranDraft((p) => ({ ...p, daily_goal: e.target.value }))} />
                    </label>
                    <label className="col-span-2 text-[11px] text-[#B9B4D9]">
                      Mushaf
                      <input className="mt-1 h-8 w-full rounded border border-white/10 bg-black/30 px-2 text-xs text-[#FFF7FB]" value={quranDraft.mushaf_version} onChange={(e) => setQuranDraft((p) => ({ ...p, mushaf_version: e.target.value }))} />
                    </label>
                    <div className="col-span-2 flex justify-end">
                      <button type="button" onClick={() => void saveQuranSettings()} className="rounded-full border border-[#d7b77866] bg-[#d7b77822] px-3 py-1 text-xs text-[#FFF7FB]">Save</button>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-[#f6f1d824] bg-[rgba(11,20,33,0.72)] p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-[#B9D8F2]">Reflection</p>
                <p className="mt-2 text-xs text-[#B9B4D9]">Open your Deen diary space.</p>
                <button type="button" onClick={() => void openReflection()} className="mt-3 rounded-full border border-[#d7b77866] bg-[#d7b77822] px-3 py-1 text-xs text-[#FFF7FB]">Open Reflection</button>
              </section>
            </div>
          </div>
            )
          )}

          {error && <p className="mt-3 text-xs text-[#FFB6DA]">{error}</p>}
        </div>
      </div>

      {reflectionOpen && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setReflectionOpen(false); }}>
          <div className="w-[min(94vw,700px)] rounded-2xl border border-white/10 bg-[rgba(12,20,34,0.94)] p-4" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-serif text-2xl text-[#F8F4FF]">🤍 Reflection</h4>
              <button type="button" onClick={() => setReflectionOpen(false)} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">✕</button>
            </div>

            {reflectionLoading ? (
              <div className="h-28 animate-pulse rounded-xl bg-white/5" />
            ) : (
              <div className="max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                {REFLECTION_QUESTIONS.map((question, index) => {
                  const key = `q${index + 1}`;
                  return (
                    <label key={key} className="block text-sm text-[#E8EAF6]">
                      {question}
                      <textarea
                        rows={2}
                        value={reflectionAnswers[key] ?? ''}
                        onChange={(event) => setReflectionAnswers((prev) => ({ ...prev, [key]: event.target.value }))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
                      />
                    </label>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => void saveReflection()} disabled={reflectionSaving} className="rounded-full border border-[#d7b77866] bg-[#d7b77822] px-4 py-1.5 text-xs text-[#FFF7FB]">
                {reflectionSaving ? 'Saving...' : 'Save Reflection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
