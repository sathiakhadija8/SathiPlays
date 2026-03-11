'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BackgroundShell } from '../layout/BackgroundShell';
import { CareerGlassCard } from './CareerGlassCard';
import { DAILY_PRACTICE_DEFAULT_ICON, DAILY_PRACTICE_PRESET_ICONS, POMODORO_LABELS, SUBJECT_COLORS } from '../../lib/career-constants';
import { getRemainingSeconds, toDateInputValue } from '../../lib/career-ui-helpers';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import type {
  Badge,
  CareerSummary,
  CvFile,
  DailyPracticeStatus,
  JobApplication,
  Roadmap,
  StudyStats,
  Subject,
} from '../../lib/career-types';

const CARD_BASE = 'h-full min-h-0 p-4';
const CAREER_BUBBLES = [
  { left: '4%', top: '12%', size: 56, duration: 26, delay: 0 },
  { left: '15%', top: '62%', size: 72, duration: 42, delay: 2 },
  { left: '29%', top: '28%', size: 44, duration: 31, delay: 1 },
  { left: '42%', top: '74%', size: 58, duration: 47, delay: 3 },
  { left: '56%', top: '18%', size: 66, duration: 39, delay: 4 },
  { left: '64%', top: '56%', size: 52, duration: 54, delay: 1 },
  { left: '77%', top: '34%', size: 80, duration: 51, delay: 5 },
  { left: '88%', top: '68%', size: 48, duration: 33, delay: 2 },
  { left: '10%', top: '84%', size: 40, duration: 59, delay: 6 },
  { left: '50%', top: '8%', size: 46, duration: 45, delay: 2 },
];

type PomodoroModalState = {
  open: boolean;
  subject: Subject | null;
};

function ModalShell({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  usePlatformWindowOpen(open);
  useEffect(() => setMounted(true), []);
  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex h-[min(86vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] shadow-[0_0_32px_rgba(255,62,165,0.18)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px] hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function CareerWorld() {
  const [summary, setSummary] = useState<CareerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [studyStats, setStudyStats] = useState<StudyStats>({
    last_7_days: { total_minutes: 0, sessions_count: 0 },
    last_30_days: { total_minutes: 0, sessions_count: 0 },
    this_year: { total_minutes: 0, sessions_count: 0 },
  });

  const [cvFiles, setCvFiles] = useState<CvFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [badges, setBadges] = useState<Badge[]>([]);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);

  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
  const [dailyPracticeModalOpen, setDailyPracticeModalOpen] = useState(false);

  const [pomodoroModal, setPomodoroModal] = useState<PomodoroModalState>({ open: false, subject: null });
  const [pomodoroSaved, setPomodoroSaved] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/career/summary', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load summary');
      const payload = (await response.json()) as CareerSummary;
      setSummary(payload);
      setStudyStats(
        payload.study_stats ?? {
          last_7_days: { total_minutes: 0, sessions_count: 0 },
          last_30_days: { total_minutes: 0, sessions_count: 0 },
          this_year: { total_minutes: 0, sessions_count: 0 },
        },
      );
    } catch {
      setError('Unable to load Career data right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCvFiles = useCallback(async () => {
    const response = await fetch('/api/career/cv', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as CvFile[];
    setCvFiles(Array.isArray(payload) ? payload : []);
  }, []);

  const loadBadges = useCallback(async () => {
    const response = await fetch('/api/career/badges', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as Badge[];
    setBadges(Array.isArray(payload) ? payload : []);
  }, []);

  useEffect(() => {
    void loadSummary();
    void loadCvFiles();
    void loadBadges();
  }, [loadSummary, loadCvFiles, loadBadges]);

  const checkIn = async (item: DailyPracticeStatus) => {
    if (!item.item_id) return;
    await fetch('/api/career/daily-practice/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.item_id, item_key: item.key_name }),
    });
    await loadSummary();
  };

  const toggleRoadmapTask = async (taskId: number, isDone: boolean) => {
    await fetch('/api/career/roadmaps/task', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, is_done: isDone }),
    });
    await loadSummary();
  };

  const deleteRoadmap = async (id: number) => {
    await fetch(`/api/career/roadmaps?id=${id}`, { method: 'DELETE' });
    await loadSummary();
  };

  const onCvUpload = async (file: File, displayName: string, tag: string) => {
    const formData = new FormData();
    formData.set('file', file);
    formData.set('display_name', displayName || file.name);
    if (tag.trim()) formData.set('tag', tag.trim());
    await fetch('/api/career/cv/upload', { method: 'POST', body: formData });
    await loadCvFiles();
  };

  const onCvDelete = async (id: number) => {
    await fetch(`/api/career/cv?id=${id}`, { method: 'DELETE' });
    await loadCvFiles();
  };

  return (
    <BackgroundShell overlayClassName="bg-[radial-gradient(circle_at_48%_34%,rgba(63,91,255,0.14),rgba(255,62,165,0.09)_38%,rgba(8,6,24,0.78)_72%)]">
      <div className="relative mx-auto flex h-full w-full max-w-[1500px] flex-col gap-3 p-3 md:p-4">
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          {CAREER_BUBBLES.map((bubble) => (
            <span
              key={`${bubble.left}-${bubble.top}-${bubble.size}`}
              className="career-bubble absolute rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),rgba(255,62,165,0.06)_48%,rgba(192,132,252,0.08)_100%)] blur-xl"
              style={{
                left: bubble.left,
                top: bubble.top,
                width: bubble.size,
                height: bubble.size,
                opacity: 0.32,
                animationDuration: `${bubble.duration}s`,
                animationDelay: `${bubble.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[65%_35%]">
              <div className="shimmer h-full rounded-2xl bg-white/10" />
              <div className="shimmer h-full rounded-2xl bg-white/10" />
            </div>
          ) : error ? (
            <div className="grid h-full place-items-center rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)]">
              <p className="font-sans text-sm text-[#F8F4FF]">{error}</p>
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-rows-[minmax(0,0.28fr)_minmax(0,0.72fr)] gap-3">
              <div className="min-h-0 p-1">
                <SubjectsCard
                  subjects={summary?.subjects ?? []}
                  onAdd={() => setSubjectModalOpen(true)}
                  onDelete={async (id) => {
                    await fetch(`/api/career/subjects?id=${id}`, { method: 'DELETE' });
                    await loadSummary();
                  }}
                  onOpenPomodoro={(subject) => {
                    setPomodoroSaved(false);
                    setPomodoroModal({ open: true, subject });
                  }}
                />
              </div>

              <div className="grid min-h-0 grid-cols-3 grid-rows-2 gap-3">
                <div className={CARD_BASE}>
                  <DailyPracticeCard
                    statuses={summary?.daily_practice_statuses ?? []}
                    onCheckIn={checkIn}
                    onOpenEditSubjects={() => setDailyPracticeModalOpen(true)}
                  />
                </div>

                <CareerGlassCard className={CARD_BASE}>
                  <StudyStatsCard stats={studyStats} />
                </CareerGlassCard>

                <CareerGlassCard className={CARD_BASE}>
                  <CvLibraryCard
                    files={cvFiles}
                    onUpload={onCvUpload}
                    onDelete={onCvDelete}
                    onPickFile={() => fileInputRef.current?.click()}
                    fileInputRef={fileInputRef}
                  />
                </CareerGlassCard>

                <CareerGlassCard className={CARD_BASE}>
                  <BadgesCard badges={badges} onAdd={() => setBadgeModalOpen(true)} />
                </CareerGlassCard>

                <CareerGlassCard className={`${CARD_BASE} col-span-2`}>
                  <RoadmapsCard
                    roadmaps={summary?.roadmaps ?? []}
                    onAdd={() => setRoadmapModalOpen(true)}
                    onToggleTask={toggleRoadmapTask}
                    onDeleteRoadmap={deleteRoadmap}
                  />
                </CareerGlassCard>
              </div>
            </div>
          )}
        </div>
      </div>

      <AddSubjectModal
        open={subjectModalOpen}
        onClose={() => setSubjectModalOpen(false)}
        onSaved={async () => {
          setSubjectModalOpen(false);
          await loadSummary();
        }}
      />

      <PomodoroModal
        open={pomodoroModal.open}
        subject={pomodoroModal.subject}
        onClose={() => setPomodoroModal({ open: false, subject: null })}
        onSaved={async () => {
          setPomodoroSaved(true);
          await loadSummary();
        }}
        saved={pomodoroSaved}
      />

      <AddRoadmapModal
        open={roadmapModalOpen}
        onClose={() => setRoadmapModalOpen(false)}
        onSaved={async () => {
          setRoadmapModalOpen(false);
          await loadSummary();
        }}
      />

      <EditDailyPracticeSubjectsModal
        open={dailyPracticeModalOpen}
        onClose={() => setDailyPracticeModalOpen(false)}
        onSaved={async () => {
          await loadSummary();
        }}
      />

      <AddBadgeModal
        open={badgeModalOpen}
        onClose={() => setBadgeModalOpen(false)}
        onSaved={async () => {
          setBadgeModalOpen(false);
          await loadBadges();
        }}
      />
    </BackgroundShell>
  );
}

function SubjectsCard({
  subjects,
  onAdd,
  onDelete,
  onOpenPomodoro,
}: {
  subjects: Subject[];
  onAdd: () => void;
  onDelete: (id: number) => Promise<void>;
  onOpenPomodoro: (subject: Subject) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF]">Subjects</h2>
        <button
          type="button"
          onClick={onAdd}
          className="micro-float rounded-full border border-[#3F5BFF66] bg-[#3F5BFF22] px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px]"
        >
          + Subject
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {subjects.length === 0 ? (
          <p className="font-sans text-sm text-[#B9B4D9]">No subjects yet. Add one to start focused sessions.</p>
        ) : (
          <div className="grid grid-cols-4 place-items-center gap-1.5 max-[900px]:grid-cols-3">
            {subjects.map((subject) => (
              <div key={subject.id} className="w-24">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenPomodoro(subject)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpenPomodoro(subject);
                    }
                  }}
                  className="group micro-float relative h-20 w-24 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.68)] p-1 text-left transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_0_14px_rgba(255,62,165,0.16)]"
                  style={{ boxShadow: `inset 0 0 0 1px ${subject.color}44` }}
                >
                  {subject.cover_image_path ? (
                    <img
                      src={subject.cover_image_path}
                      alt={subject.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-90"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-black/35 text-base">{subject.icon_key}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={async (event) => {
                      event.stopPropagation();
                      await onDelete(subject.id);
                    }}
                    className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/25 px-1.5 text-[10px] text-[#B9B4D9] opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    x
                  </button>
                </div>
                <p className="mt-1 line-clamp-2 text-center font-sans text-[9px] leading-tight text-[#F8F4FF]">{subject.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DailyPracticeCard({
  statuses,
  onCheckIn,
  onOpenEditSubjects,
}: {
  statuses: DailyPracticeStatus[];
  onCheckIn: (item: DailyPracticeStatus) => Promise<void>;
  onOpenEditSubjects: () => void;
}) {
  const [savingItemId, setSavingItemId] = useState<number | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col px-1">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF]">Daily Practice</h2>
        <button
          type="button"
          onClick={onOpenEditSubjects}
          className="micro-float rounded-full border border-[#FF3EA566] bg-transparent px-2.5 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-200 hover:bg-[#FF3EA522]"
          aria-label="Edit Daily Practice Subjects"
        >
          ✨
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {statuses.map((item) => {
            const checked = item.checked_in_today;
            const disabled = savingItemId === item.item_id;
            const iconUrl = item.icon_type === 'upload' ? item.uploaded_icon_url : null;
            const presetIcon = item.preset_icon ?? DAILY_PRACTICE_DEFAULT_ICON;

            return (
              <button
                key={`${item.item_id}-${item.key_name}`}
                type="button"
                disabled={disabled || !item.item_id}
                onClick={async () => {
                  if (!item.item_id) return;
                  setSavingItemId(item.item_id);
                  try {
                    await onCheckIn(item);
                  } finally {
                    setSavingItemId(null);
                  }
                }}
                className={`group flex h-[82px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 text-center transition-all duration-200 ${
                  checked
                    ? 'border-[#FF3EA5] bg-[#FF3EA5] text-white'
                    : 'border-white/35 bg-transparent text-[#F8F4FF] hover:border-white/80'
                } ${disabled ? 'opacity-70' : ''}`}
              >
                {iconUrl ? (
                  <img src={iconUrl} alt={item.display_name} className="h-8 w-8 rounded-full border border-white/30 object-cover" />
                ) : (
                  <span className="text-xl leading-none">{presetIcon}</span>
                )}
                <span className="line-clamp-2 text-[11px] font-medium leading-tight">{item.display_name}</span>
              </button>
            );
          })}
          {statuses.length === 0 ? <p className="col-span-full font-sans text-xs text-[#B9B4D9]">No daily practice subjects yet.</p> : null}
        </div>
      </div>
    </div>
  );
}

function RoadmapsCard({
  roadmaps,
  onAdd,
  onToggleTask,
  onDeleteRoadmap,
}: {
  roadmaps: Roadmap[];
  onAdd: () => void;
  onToggleTask: (taskId: number, isDone: boolean) => Promise<void>;
  onDeleteRoadmap: (roadmapId: number) => Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF]">Roadmaps</h2>
        <button
          type="button"
          onClick={onAdd}
          className="micro-float rounded-full border border-[#3F5BFF66] bg-[#3F5BFF22] px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px]"
        >
          + Roadmap
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {roadmaps.length === 0 ? (
          <p className="font-sans text-sm text-[#B9B4D9]">No roadmaps yet.</p>
        ) : (
          roadmaps.map((roadmap) => {
            const progress = roadmap.total_count === 0 ? 0 : Math.round((roadmap.completed_count / roadmap.total_count) * 100);
            const expanded = expandedId === roadmap.id;
            return (
              <div key={roadmap.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedId(expanded ? null : roadmap.id)}
                  >
                    <p className="truncate font-sans text-sm text-[#F8F4FF]">{roadmap.title}</p>
                    <p className="font-sans text-xs text-[#B9B4D9]">{roadmap.completed_count}/{roadmap.total_count} tasks</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteRoadmap(roadmap.id)}
                    className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#B9B4D9]"
                  >
                    delete
                  </button>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#3F5BFF] to-[#FF3EA5]" style={{ width: `${progress}%` }} />
                </div>

                {expanded && (
                  <div className="mt-2 space-y-1.5">
                    {roadmap.tasks.map((task) => (
                      <label key={task.id} className={`flex items-center gap-2 text-sm ${task.is_done ? 'opacity-55' : ''}`}>
                        <input
                          type="checkbox"
                          checked={task.is_done === 1}
                          onChange={(event) => void onToggleTask(task.id, event.target.checked)}
                        />
                        <span className="font-sans text-[#F8F4FF]">{task.text}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function StudyStatsCard({ stats }: { stats: StudyStats }) {
  const tiles = [
    { key: '7d', label: '7 Days', data: stats.last_7_days },
    { key: '30d', label: '30 Days', data: stats.last_30_days },
    { key: 'year', label: 'This Year', data: stats.this_year },
  ] as const;
  const maxMinutes = Math.max(1, ...tiles.map((tile) => tile.data.total_minutes));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF] drop-shadow-[0_0_10px_rgba(34,211,238,0.45)]">Study Stats</h2>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 md:grid-cols-3">
        {tiles.map((tile) => {
          const progress = Math.max(4, Math.round((tile.data.total_minutes / maxMinutes) * 100));
          return (
            <div key={tile.key} className="rounded-2xl border border-[#22D3EE66] bg-black/25 px-3 py-2.5">
              <p className="font-sans text-[11px] text-[#EAFBFF]">{tile.label}</p>
              <p className="mt-1 font-serif text-2xl leading-none text-white">{formatMinutes(tile.data.total_minutes)}</p>
              <p className="mt-1 font-sans text-[11px] text-[#D9F8FF]">sessions: {tile.data.sessions_count}</p>
              <div className="mt-2 h-[2px] w-full rounded-full bg-[#22D3EE33]">
                <div className="h-full rounded-full bg-[#22D3EE]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CvLibraryCard({
  files,
  onUpload,
  onDelete,
  onPickFile,
  fileInputRef,
}: {
  files: CvFile[];
  onUpload: (file: File, displayName: string, tag: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onPickFile: () => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const [tag, setTag] = useState('');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF]">CV Library</h2>
        <button
          type="button"
          onClick={onPickFile}
          className="micro-float rounded-full border border-[#FF3EA560] bg-[#FF3EA522] px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px]"
        >
          Upload
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          await onUpload(file, file.name.replace(/\.[^/.]+$/, ''), tag);
          event.target.value = '';
        }}
      />

      <input
        value={tag}
        onChange={(event) => setTag(event.target.value)}
        placeholder="Optional tag (Data Analyst)"
        className="mb-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-sans text-xs text-[#F8F4FF] placeholder:text-[#B9B4D9]"
      />

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {files.length === 0 ? (
          <p className="font-sans text-sm text-[#B9B4D9]">No CV files yet.</p>
        ) : (
          files.slice(0, 8).map((file) => (
            <div
              key={file.id}
              className="group relative rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 transition-all duration-200 hover:-translate-y-[1px] hover:border-[#FF3EA544]"
            >
              <a href={file.file_path} target="_blank" rel="noreferrer" className="block pr-10">
                <p className="truncate font-sans text-sm text-[#F8F4FF]">{file.display_name}</p>
                <p className="font-sans text-[11px] text-[#B9B4D9]">{file.tag ?? 'General'}</p>
              </a>
              <button
                type="button"
                onClick={() => {
                  void onDelete(file.id);
                }}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-[#ff6aa880] bg-[#2A1530E6] px-2 py-0.5 font-sans text-[10px] text-[#FFD6E8] opacity-0 transition-opacity duration-200 hover:bg-[#34163B] group-hover:pointer-events-auto group-hover:opacity-100 focus:pointer-events-auto focus:opacity-100 focus:outline-none"
                aria-label={`Delete CV ${file.display_name}`}
                title="Delete CV"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BadgesCard({ badges, onAdd }: { badges: Badge[]; onAdd: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF]">Certification Badges</h2>
        <button
          type="button"
          onClick={onAdd}
          className="micro-float rounded-full border border-[#3F5BFF66] bg-[#3F5BFF22] px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px]"
        >
          + Badge
        </button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {badges.length === 0 ? (
          <p className="col-span-2 font-sans text-sm text-[#B9B4D9]">No badges yet.</p>
        ) : (
          badges.map((badge) => (
            <div key={badge.id} className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
              <div className="mb-1 flex items-center gap-2">
                {badge.badge_image_path ? (
                  <img
                    src={badge.badge_image_path}
                    alt={badge.title}
                    className="h-8 w-8 rounded-full border border-white/15 object-cover"
                  />
                ) : (
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full"
                    style={{ backgroundColor: `${badge.badge_color ?? '#C084FC'}33` }}
                  >
                    {badge.badge_icon_key ?? '🏅'}
                  </span>
                )}
                <p className="truncate font-sans text-sm text-[#F8F4FF]">{badge.title}</p>
              </div>
              <p className="truncate font-sans text-[11px] text-[#B9B4D9]">{badge.issuer ?? 'Self-paced'}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type DailyPracticeItemEditor = {
  id: number;
  key_name: string | null;
  title: string;
  icon_type: 'preset' | 'upload';
  preset_icon: string | null;
  uploaded_icon_url: string | null;
};

function EditDailyPracticeSubjectsModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<DailyPracticeItemEditor[]>([]);

  const [newTitle, setNewTitle] = useState('');
  const [newIconType, setNewIconType] = useState<'preset' | 'upload'>('preset');
  const [newPresetIcon, setNewPresetIcon] = useState<string>(DAILY_PRACTICE_PRESET_ICONS[0]);
  const [newUploadedIconUrl, setNewUploadedIconUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/career/daily-practice/items', { cache: 'no-store' });
      const payload = (await response.json()) as Array<{
        id: number;
        key_name: string | null;
        title: string;
        icon_type: 'preset' | 'upload';
        preset_icon: string | null;
        uploaded_icon_url: string | null;
      }> | { message?: string };
      if (!response.ok || !Array.isArray(payload)) {
        setError(typeof payload === 'object' && payload && 'message' in payload ? String(payload.message ?? 'Unable to load items.') : 'Unable to load items.');
        setItems([]);
        return;
      }

      setItems(
        payload.map((item) => ({
          id: item.id,
          key_name: item.key_name ?? null,
          title: item.title,
          icon_type: item.icon_type ?? 'preset',
          preset_icon: item.preset_icon ?? DAILY_PRACTICE_DEFAULT_ICON,
          uploaded_icon_url: item.uploaded_icon_url ?? null,
        })),
      );
    } catch {
      setError('Unable to load items.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open, loadItems]);

  const uploadIconFile = async (file: File) => {
    const formData = new FormData();
    formData.set('file', file);
    const response = await fetch('/api/career/daily-practice/items/upload', {
      method: 'POST',
      body: formData,
    });
    const payload = (await response.json()) as { uploaded_icon_url?: string; message?: string };
    if (!response.ok || !payload.uploaded_icon_url) {
      throw new Error(payload.message ?? 'Unable to upload icon.');
    }
    return payload.uploaded_icon_url;
  };

  const createItem = async () => {
    if (!newTitle.trim()) return;
    if (newIconType === 'upload' && !newUploadedIconUrl) {
      setError('Upload an icon image for upload type.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/career/daily-practice/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          icon_type: newIconType,
          preset_icon: newIconType === 'preset' ? newPresetIcon : null,
          uploaded_icon_url: newIconType === 'upload' ? newUploadedIconUrl : null,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to create item.');
        return;
      }
      setNewTitle('');
      setNewIconType('preset');
      setNewPresetIcon(DAILY_PRACTICE_PRESET_ICONS[0]);
      setNewUploadedIconUrl('');
      await loadItems();
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async (item: DailyPracticeItemEditor) => {
    if (!item.title.trim()) return;
    if (item.icon_type === 'upload' && !item.uploaded_icon_url) {
      setError('Upload an icon image for upload type.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/career/daily-practice/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          title: item.title.trim(),
          icon_type: item.icon_type,
          preset_icon: item.icon_type === 'preset' ? (item.preset_icon ?? DAILY_PRACTICE_DEFAULT_ICON) : null,
          uploaded_icon_url: item.icon_type === 'upload' ? item.uploaded_icon_url : null,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to update item.');
        return;
      }
      await loadItems();
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: number) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/career/daily-practice/items?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        setError(payload.message ?? 'Unable to delete item.');
        return;
      }
      await loadItems();
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell open={open} title="Edit Daily Practice Subjects" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 font-sans text-xs text-[#B9B4D9]">Add Subject</p>
          <div className="grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
            <input
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Title"
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[#F8F4FF] placeholder:text-[#B9B4D9]"
            />
            <select
              value={newIconType}
              onChange={(event) => setNewIconType(event.target.value === 'upload' ? 'upload' : 'preset')}
              className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[#F8F4FF]"
            >
              <option value="preset">Preset</option>
              <option value="upload">Upload</option>
            </select>
            {newIconType === 'preset' ? (
              <select
                value={newPresetIcon}
                onChange={(event) => setNewPresetIcon(event.target.value)}
                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[#F8F4FF]"
              >
                {DAILY_PRACTICE_PRESET_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                <input
                  type="file"
                  accept="image/*"
                  className="text-xs text-[#F8F4FF]"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      setSaving(true);
                      const url = await uploadIconFile(file);
                      setNewUploadedIconUrl(url);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Unable to upload icon.');
                    } finally {
                      setSaving(false);
                      event.target.value = '';
                    }
                  }}
                />
              </div>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => void createItem()}
              className="rounded-full border border-[#FF3EA560] bg-[#FF3EA522] px-3 py-1 text-xs text-[#F8F4FF] disabled:opacity-60"
            >
              Add
            </button>
          </div>
          {newIconType === 'upload' && newUploadedIconUrl ? (
            <p className="mt-1 text-[11px] text-[#B9B4D9]">Uploaded icon ready.</p>
          ) : null}
        </div>

        {error ? <p className="text-xs text-[#FCA5A5]">{error}</p> : null}

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-[#B9B4D9]">Loading subjects...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[#B9B4D9]">No daily practice subjects yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_120px_1fr_auto_auto]">
                  <input
                    value={item.title}
                    onChange={(event) =>
                      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, title: event.target.value } : row)))
                    }
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[#F8F4FF]"
                  />
                  <select
                    value={item.icon_type}
                    onChange={(event) => {
                      const nextIconType = event.target.value === 'upload' ? 'upload' : 'preset';
                      setItems((prev) =>
                        prev.map((row) => {
                          if (row.id !== item.id) return row;
                          if (nextIconType === 'preset') {
                            return {
                              ...row,
                              icon_type: 'preset',
                              preset_icon: row.preset_icon ?? DAILY_PRACTICE_DEFAULT_ICON,
                            };
                          }
                          return { ...row, icon_type: 'upload' };
                        }),
                      );
                    }}
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[#F8F4FF]"
                  >
                    <option value="preset">Preset</option>
                    <option value="upload">Upload</option>
                  </select>
                  {item.icon_type === 'preset' ? (
                    <select
                      value={item.preset_icon ?? DAILY_PRACTICE_DEFAULT_ICON}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((row) => (row.id === item.id ? { ...row, preset_icon: event.target.value } : row)),
                        )
                      }
                      className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-[#F8F4FF]"
                    >
                      {DAILY_PRACTICE_PRESET_ICONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                      <input
                        type="file"
                        accept="image/*"
                        className="text-xs text-[#F8F4FF]"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          try {
                            setSaving(true);
                            const url = await uploadIconFile(file);
                            setItems((prev) =>
                              prev.map((row) => (row.id === item.id ? { ...row, uploaded_icon_url: url } : row)),
                            );
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Unable to upload icon.');
                          } finally {
                            setSaving(false);
                            event.target.value = '';
                          }
                        }}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void updateItem(item)}
                    className="rounded-full border border-[#3F5BFF66] bg-[#3F5BFF22] px-3 py-1 text-xs text-[#F8F4FF] disabled:opacity-60"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void deleteItem(item.id)}
                    className="rounded-full border border-white/25 px-3 py-1 text-xs text-[#F8F4FF] disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function AddSubjectModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(SUBJECT_COLORS[0]);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set('name', name);
    formData.set('color', color);
    if (coverFile) formData.set('cover_file', coverFile);

    await fetch('/api/career/subjects', {
      method: 'POST',
      body: formData,
    });
    setName('');
    setCoverFile(null);
    await onSaved();
  };

  return (
    <ModalShell open={open} title="Add Subject" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Subject name"
          required
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-sans text-sm text-[#F8F4FF] placeholder:text-[#B9B4D9]"
        />

        <div>
          <p className="mb-1 font-sans text-xs text-[#B9B4D9]">Color</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                className={`h-7 w-7 rounded-full border ${color === value ? 'border-white' : 'border-white/20'}`}
                style={{ backgroundColor: value }}
              />
            ))}
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="h-7 w-10 rounded" />
          </div>
        </div>

        <div>
          <p className="mb-1 font-sans text-xs text-[#B9B4D9]">Cover image (optional)</p>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 font-sans text-xs text-[#F8F4FF]"
          />
        </div>

        <button type="submit" className="rounded-full border border-[#FF3EA560] bg-[#FF3EA522] px-4 py-1.5 font-sans text-sm text-[#F8F4FF]">
          Save
        </button>
      </form>
    </ModalShell>
  );
}

function PomodoroModal({
  open,
  subject,
  onClose,
  onSaved,
  saved,
}: {
  open: boolean;
  subject: Subject | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  saved: boolean;
}) {
  const [label, setLabel] = useState<string>(POMODORO_LABELS[0]);
  const [plannedMinutes, setPlannedMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState('');
  const [running, setRunning] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [remaining, setRemaining] = useState(plannedMinutes * 60);

  const activePlannedMinutes = useMemo(() => {
    if (plannedMinutes !== -1) return plannedMinutes;
    const parsed = Number(customMinutes);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 25;
  }, [plannedMinutes, customMinutes]);

  useEffect(() => {
    if (!running || !sessionStart) return;
    const intervalId = window.setInterval(() => {
      const left = getRemainingSeconds(sessionStart.getTime(), activePlannedMinutes);
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
      }
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [running, sessionStart, activePlannedMinutes]);

  useEffect(() => {
    if (!open) {
      setRunning(false);
      setSessionStart(null);
      setRemaining(activePlannedMinutes * 60);
    }
  }, [open, activePlannedMinutes]);

  const start = () => {
    const startAt = new Date();
    setSessionStart(startAt);
    setRemaining(activePlannedMinutes * 60);
    setRunning(true);
  };

  const endEarly = () => {
    setRunning(false);
  };

  const save = async () => {
    if (!subject) return;
    const startAt = sessionStart ?? new Date();
    const endedAt = new Date();
    const elapsedMinutes = Math.max(0, Math.round((endedAt.getTime() - startAt.getTime()) / 60000));

    await fetch('/api/career/pomodoro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject_id: subject.id,
        label,
        planned_minutes: activePlannedMinutes,
        actual_minutes: Math.min(activePlannedMinutes, elapsedMinutes),
        started_at: nowSqlDateTimeFromDate(startAt),
        ended_at: nowSqlDateTimeFromDate(endedAt),
      }),
    });

    await onSaved();
    setRunning(false);
    setSessionStart(null);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <ModalShell open={open} title={subject ? `${subject.name} · Pomodoro` : 'Pomodoro'} onClose={onClose}>
      {!subject ? null : (
        <div className="space-y-4">
          <div>
            <p className="mb-2 font-sans text-xs text-[#B9B4D9]">Session label</p>
            <div className="flex flex-wrap gap-2">
              {POMODORO_LABELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLabel(value)}
                  className={`rounded-full border px-3 py-1 text-xs ${label === value ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-sans text-xs text-[#B9B4D9]">Planned minutes</p>
            <div className="flex flex-wrap gap-2">
              {[25, 45, 60].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPlannedMinutes(value)}
                  className={`rounded-full border px-3 py-1 text-xs ${plannedMinutes === value ? 'border-[#3F5BFF66] bg-[#3F5BFF22] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}
                >
                  {value}m
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPlannedMinutes(-1)}
                className={`rounded-full border px-3 py-1 text-xs ${plannedMinutes === -1 ? 'border-[#3F5BFF66] bg-[#3F5BFF22] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}
              >
                Custom
              </button>
              {plannedMinutes === -1 && (
                <input
                  type="number"
                  min={1}
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  className="w-20 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-sm text-[#F8F4FF]"
                />
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
            <p className="font-sans text-xs text-[#B9B4D9]">Countdown</p>
            <p className="mt-1 font-serif text-5xl text-[#F8F4FF]">{mm}:{ss}</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {!running ? (
                <button type="button" onClick={start} className="rounded-full border border-[#FF3EA560] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF]">
                  Start
                </button>
              ) : (
                <button type="button" onClick={endEarly} className="rounded-full border border-white/20 px-4 py-1.5 text-sm text-[#F8F4FF]">
                  End early
                </button>
              )}
              {sessionStart && !running && (
                <button type="button" onClick={() => void save()} className="rounded-full border border-[#3F5BFF66] bg-[#3F5BFF22] px-4 py-1.5 text-sm text-[#F8F4FF]">
                  Save log
                </button>
              )}
            </div>
            {saved && <p className="mt-2 font-sans text-xs text-[#FFB4DC]">Saved ✓</p>}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function AddRoadmapModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [taskText, setTaskText] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const tasks = taskText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    await fetch('/api/career/roadmaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, tasks }),
    });

    setTitle('');
    setTaskText('');
    await onSaved();
  };

  return (
    <ModalShell open={open} title="Add Roadmap" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Roadmap title"
          required
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-[#F8F4FF]"
        />
        <textarea
          value={taskText}
          onChange={(event) => setTaskText(event.target.value)}
          rows={8}
          placeholder={'Task list, one per line\nBuild resume\nDo 3 mock interviews\nApply to 10 roles'}
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-[#F8F4FF]"
        />
        <button type="submit" className="rounded-full border border-[#FF3EA560] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF]">
          Save roadmap
        </button>
      </form>
    </ModalShell>
  );
}

function JobsModal({
  open,
  jobs,
  onClose,
  onChanged,
}: {
  open: boolean;
  jobs: JobApplication[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [appliedCount, setAppliedCount] = useState('1');
  const [workMode, setWorkMode] = useState<JobApplication['work_mode']>('remote');
  const [updateNote, setUpdateNote] = useState('');

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    await fetch('/api/career/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applied_count: Number(appliedCount), work_mode: workMode, update_note: updateNote }),
    });
    setAppliedCount('1');
    setWorkMode('remote');
    setUpdateNote('');
    await onChanged();
  };

  return (
    <ModalShell open={open} title="Job Hunting" onClose={onClose}>
      <form className="grid grid-cols-1 gap-2 md:grid-cols-3" onSubmit={create}>
        <input
          type="number"
          min={0}
          max={500}
          value={appliedCount}
          onChange={(e) => setAppliedCount(e.target.value)}
          placeholder="How many applied?"
          required
          className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm text-[#F8F4FF]"
        />
        <select
          value={workMode}
          onChange={(e) => setWorkMode(e.target.value as JobApplication['work_mode'])}
          className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm text-[#F8F4FF]"
        >
          <option value="remote">Remote</option>
          <option value="in">In-person</option>
        </select>
        <input
          value={updateNote}
          onChange={(e) => setUpdateNote(e.target.value)}
          placeholder="Update note"
          className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm text-[#F8F4FF]"
        />
        <button type="submit" className="md:col-span-3 w-fit rounded-full border border-[#FF3EA560] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF]">Save log</button>
      </form>

      <div className="mt-4 space-y-2">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[#F8F4FF]">{job.applied_count} applied · {job.work_mode === 'remote' ? 'Remote' : 'In-person'}</p>
                {job.update_note && <p className="truncate text-xs text-[#B9B4D9]">{job.update_note}</p>}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/career/jobs?id=${job.id}`, { method: 'DELETE' });
                  await onChanged();
                }}
                className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#B9B4D9]"
              >
                delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function AddBadgeModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [completedDate, setCompletedDate] = useState(toDateInputValue());
  const [icon, setIcon] = useState('🏅');
  const [color, setColor] = useState('#C084FC');
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    let badgeImagePath: string | null = null;
    if (badgeFile) {
      setUploading(true);
      const formData = new FormData();
      formData.set('file', badgeFile);
      const uploadRes = await fetch('/api/career/badges/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadPayload = (await uploadRes.json()) as { file_path?: string };
      if (uploadRes.ok && uploadPayload.file_path) {
        badgeImagePath = uploadPayload.file_path;
      }
      setUploading(false);
    }

    await fetch('/api/career/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        issuer,
        completed_date: completedDate,
        badge_icon_key: icon,
        badge_color: color,
        badge_image_path: badgeImagePath,
      }),
    });
    setTitle('');
    setIssuer('');
    setBadgeFile(null);
    await onSaved();
  };

  return (
    <ModalShell open={open} title="Add Badge" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Badge title" className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-[#F8F4FF]" />
        <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Issuer" className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-[#F8F4FF]" />
        <div className="grid grid-cols-3 gap-2">
          <input type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm text-[#F8F4FF]" />
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-sm text-[#F8F4FF]" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-black/25 p-1" />
        </div>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setBadgeFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-[#F8F4FF] file:mr-3 file:rounded-full file:border-0 file:bg-[#FF3EA522] file:px-3 file:py-1 file:text-xs file:text-[#F8F4FF]"
        />
        <button type="submit" disabled={uploading} className="rounded-full border border-[#FF3EA560] bg-[#FF3EA522] px-4 py-1.5 text-sm text-[#F8F4FF] disabled:opacity-60">{uploading ? 'Uploading...' : 'Save badge'}</button>
      </form>
    </ModalShell>
  );
}

function nowSqlDateTimeFromDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}
