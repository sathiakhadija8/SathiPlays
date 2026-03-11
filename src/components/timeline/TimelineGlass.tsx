'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlassCard } from '../GlassCard';
import {
  formatTime,
  getTaskStatus,
  timelineStatusLabel,
  todayYMD,
  type TimelineTask,
} from '../../lib/timeline-helpers';
import { TimelineModal } from './TimelineModal';
import { useUpcomingSalah } from '../../hooks/useUpcomingSalah';

function statusChip(status: ReturnType<typeof getTaskStatus>) {
  if (status === 'in_progress') return 'bg-[#FF3EA522] text-[#F8F4FF] border-[#FF3EA566]';
  if (status === 'completed') return 'bg-white/10 text-[#B9B4D9] border-white/10';
  if (status === 'missed') return 'bg-[#FF3EA514] text-[#FF86C8] border-[#FF3EA544]';
  return 'bg-white/10 text-[#B9B4D9] border-white/10';
}

export function TimelineGlass() {
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'today' | 'plan'>('today');
  const [now, setNow] = useState(new Date());
  const upcomingSalah = useUpcomingSalah(true);

  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/timeline/today?date=${todayYMD()}`, { cache: 'no-store' });
      if (!response.ok) {
        setTasks([]);
        return;
      }
      const payload = (await response.json().catch(() => [])) as TimelineTask[];
      setTasks(Array.isArray(payload) ? payload : []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const dateLabel = useMemo(
    () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    [now],
  );

  const handleChanged = useCallback(async () => {
    await loadToday();
    await upcomingSalah.refetch();
  }, [loadToday, upcomingSalah]);

  return (
    <>
      <GlassCard
        className="flex-[1.2] cursor-pointer p-4 max-[900px]:p-2.5"
        role="button"
        tabIndex={0}
        onClick={() => {
          setInitialTab('today');
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setInitialTab('today');
            setOpen(true);
          }
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl text-[#F8F4FF]">Timeline</h2>
            <p className="font-sans text-xs text-[#B9B4D9]">Today • {dateLabel}</p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setInitialTab('plan');
              setOpen(true);
            }}
            className="rounded-full border border-[#FF3EA560] bg-[#FF3EA51A] px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#FF3EA533]"
          >
            + Add
          </button>
        </div>

        <div className="h-[220px] overflow-y-auto pr-1 max-[900px]:h-[168px]">
          <div className="mb-2 rounded-xl border border-[#9AA7FF40] bg-[rgba(44,54,120,0.18)] px-3 py-2">
            <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">Upcoming Salah</p>
            {upcomingSalah.loading ? (
              <p className="mt-1 font-sans text-xs text-[#B9B4D9]">Loading salah time...</p>
            ) : upcomingSalah.upcoming ? (
              <p className="mt-1 font-sans text-sm text-[#F8F4FF]">
                {upcomingSalah.upcoming.label} · {upcomingSalah.upcoming.time ?? '--:--'}
              </p>
            ) : upcomingSalah.salahCompleted ? (
              <p className="mt-1 font-sans text-xs text-[#B9B4D9]">All salah checked for today.</p>
            ) : (
              <p className="mt-1 font-sans text-xs text-[#B9B4D9]">Salah timeline unavailable.</p>
            )}
          </div>

          {loading ? (
            <div className="shimmer h-full w-full rounded-xl bg-white/10" />
          ) : tasks.length === 0 ? (
            <p className="font-sans text-sm text-[#B9B4D9]">No tasks for today.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => {
                const status = getTaskStatus(task, now);
                const completed = status === 'completed';
                const inProgress = status === 'in_progress';
                return (
                  <li
                    key={task.id}
                    className={`rounded-xl border border-white/10 bg-black/25 px-3 py-2 transition-all duration-300 ${
                      completed ? 'opacity-50' : ''
                    } ${inProgress ? 'shadow-[0_0_14px_rgba(255,62,165,0.22)]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-sans text-xs text-[#B9B4D9]">
                          {formatTime(task.start_at)} - {formatTime(task.end_at)}
                        </p>
                        <p className="font-sans text-sm text-[#F8F4FF]">{task.title}</p>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 font-sans text-[10px] ${statusChip(status)}`}>
                        {timelineStatusLabel(status)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </GlassCard>

      <TimelineModal
        open={open}
        initialTab={initialTab}
        onClose={() => setOpen(false)}
        onChanged={handleChanged}
      />
    </>
  );
}
