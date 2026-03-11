'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  type TimelineChecklistItem,
  type TimelineTask,
  todayYMD,
} from '../../lib/timeline-helpers';
import { TodayTimelineList } from './TodayTimelineList';
import { PlanAddTaskForm } from './PlanAddTaskForm';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import { useUpcomingSalah } from '../../hooks/useUpcomingSalah';

type Tab = 'today' | 'plan';

type TimelineModalProps = {
  open: boolean;
  initialTab?: Tab;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

export function TimelineModal({ open, initialTab = 'today', onClose, onChanged }: TimelineModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const upcomingSalah = useUpcomingSalah(open);
  usePlatformWindowOpen(open);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const loadToday = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/timeline/today?date=${todayYMD()}`, { cache: 'no-store' });
      const payload = (await response.json()) as TimelineTask[];
      setTasks(Array.isArray(payload) ? payload : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadToday();
  }, [open]);

  const refreshAll = async () => {
    await loadToday();
    await upcomingSalah.refetch();
    await onChanged();
  };

  const toggleChecklist = async (item: TimelineChecklistItem, value: boolean) => {
    await fetch('/api/timeline/checklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, is_done: value }),
    });
    await refreshAll();
  };

  const toggleComplete = async (task: TimelineTask, completed: boolean) => {
    await fetch('/api/timeline/complete', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: task.id, completed }),
    });
    await refreshAll();
  };

  const checkUpcomingSalah = async () => {
    const ok = await upcomingSalah.checkInUpcoming();
    if (ok) {
      await onChanged();
    }
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 backdrop-blur-sm">
      <div className="glass-depth-main flex h-[min(88vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_36px_rgba(255,62,165,0.2)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">Timeline Window</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/15 px-3 py-1 text-sm text-[#F8F4FF] hover:bg-white/10">Close</button>
        </div>

        <div className="flex gap-2 px-4 py-3">
          {(['today', 'plan'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-full border px-3 py-1 font-sans text-xs uppercase tracking-wide transition-all duration-300 hover:-translate-y-[1px] ${
                tab === value ? 'border-[#FF3EA560] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/10 bg-white/5 text-[#B9B4D9]'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {tab === 'today' ? (
            <TodayTimelineList
              tasks={tasks}
              loading={loading}
              now={now}
              onToggleChecklist={toggleChecklist}
              onToggleComplete={toggleComplete}
              upcomingSalah={upcomingSalah.upcoming}
              upcomingSalahLoading={upcomingSalah.loading}
              upcomingSalahSaving={upcomingSalah.saving}
              salahCompleted={upcomingSalah.salahCompleted}
              onCheckUpcomingSalah={checkUpcomingSalah}
            />
          ) : (
            <PlanAddTaskForm
              onSaved={async () => {
                await refreshAll();
                setTab('today');
              }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
