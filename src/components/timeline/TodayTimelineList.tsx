'use client';

import { useMemo, useState } from 'react';
import {
  formatTime,
  getTaskStatus,
  minutesLeft,
  type TimelineChecklistItem,
  type TimelineStatus,
  type TimelineTask,
  timelineStatusLabel,
} from '../../lib/timeline-helpers';
import type { UpcomingSalah } from '../../hooks/useUpcomingSalah';

type TodayTimelineListProps = {
  tasks: TimelineTask[];
  loading?: boolean;
  now: Date;
  onToggleChecklist: (item: TimelineChecklistItem, value: boolean) => Promise<void>;
  onToggleComplete: (task: TimelineTask, completed: boolean) => Promise<void>;
  upcomingSalah: UpcomingSalah | null;
  upcomingSalahLoading?: boolean;
  upcomingSalahSaving?: boolean;
  salahCompleted?: boolean;
  onCheckUpcomingSalah: () => Promise<void>;
};

function statusChip(status: TimelineStatus) {
  if (status === 'in_progress') return 'bg-[#FF3EA522] text-[#F8F4FF] border-[#FF3EA566]';
  if (status === 'completed') return 'bg-white/10 text-[#B9B4D9] border-white/10';
  if (status === 'missed') return 'bg-[#FF3EA514] text-[#FF86C8] border-[#FF3EA544]';
  return 'bg-white/10 text-[#B9B4D9] border-white/10';
}

export function TodayTimelineList({
  tasks,
  loading = false,
  now,
  onToggleChecklist,
  onToggleComplete,
  upcomingSalah,
  upcomingSalahLoading = false,
  upcomingSalahSaving = false,
  salahCompleted = false,
  onCheckUpcomingSalah,
}: TodayTimelineListProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const sorted = useMemo(() => tasks, [tasks]);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <h4 className="mb-2 font-serif text-lg text-[#F8F4FF]">Today Execution</h4>
      <div className="h-[320px] overflow-y-auto pr-1">
        <div className="mb-2 rounded-xl border border-[#9AA7FF40] bg-[rgba(44,54,120,0.18)] px-3 py-2">
          <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-[#B9B4D9]">Upcoming Salah</p>
          {upcomingSalahLoading ? (
            <p className="mt-1 font-sans text-xs text-[#B9B4D9]">Loading salah time...</p>
          ) : upcomingSalah ? (
            upcomingSalah.isNextDay ? (
              <p className="mt-1 font-sans text-sm text-[#F8F4FF]">
                {upcomingSalah.label} · {upcomingSalah.time ?? '--:--'}
              </p>
            ) : (
              <label className="mt-1 flex items-center gap-2 font-sans text-sm text-[#F8F4FF]">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={upcomingSalahSaving}
                  onChange={() => {
                    void onCheckUpcomingSalah();
                  }}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-black/30 accent-[#FF3EA5]"
                />
                <span>
                  {upcomingSalah.label} prayed · {upcomingSalah.time ?? '--:--'}
                </span>
              </label>
            )
          ) : salahCompleted ? (
            <p className="mt-1 font-sans text-xs text-[#B9B4D9]">All salah checked for today.</p>
          ) : (
            <p className="mt-1 font-sans text-xs text-[#B9B4D9]">Salah timeline unavailable.</p>
          )}
        </div>

        {loading ? (
          <div className="shimmer h-full w-full rounded-xl bg-white/10" />
        ) : sorted.length === 0 ? (
          <p className="font-sans text-sm text-[#B9B4D9]">No tasks planned yet.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((task) => {
              const status = getTaskStatus(task, now);
              const isExpanded = expanded === task.id;
              const inProgress = status === 'in_progress';
              const completed = status === 'completed';
              return (
                <li
                  key={task.id}
                  className={`rounded-xl border border-white/10 bg-black/25 p-2 transition-all duration-300 ${
                    completed ? 'opacity-50' : ''
                  } ${inProgress ? 'shadow-[0_0_16px_rgba(255,62,165,0.24)]' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : task.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-sans text-xs text-[#B9B4D9]">
                          {formatTime(task.start_at)} - {formatTime(task.end_at)}
                        </p>
                        <p className="font-sans text-sm text-[#F8F4FF]">{task.title}</p>
                        {inProgress && <p className="font-sans text-xs text-[#B9B4D9]">Time left: {minutesLeft(task, now)}m</p>}
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 font-sans text-[10px] ${statusChip(status)}`}>
                        {timelineStatusLabel(status)}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                      <p className="font-sans text-xs text-[#B9B4D9]">Window: {formatTime(task.start_at)}-{formatTime(task.end_at)}</p>
                      <div className="space-y-1">
                        {task.checklist.length === 0 ? (
                          <p className="font-sans text-xs text-[#B9B4D9]">No checklist items.</p>
                        ) : (
                          task.checklist.map((item) => (
                            <label key={item.id} className="flex items-center gap-2 font-sans text-xs text-[#F8F4FF]">
                              <input
                                type="checkbox"
                                checked={item.is_done}
                                onChange={(event) => {
                                  void onToggleChecklist(item, event.target.checked);
                                }}
                                className="h-3.5 w-3.5 rounded border-white/20 bg-black/30 accent-[#FF3EA5]"
                              />
                              <span className={item.is_done ? 'opacity-60 line-through' : ''}>{item.text}</span>
                            </label>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void onToggleComplete(task, !task.completed_at)}
                        className="rounded-full border border-[#FF3EA560] bg-[#FF3EA51A] px-3 py-1 font-sans text-[11px] text-[#F8F4FF] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#FF3EA533]"
                      >
                        {task.completed_at ? 'Mark incomplete' : 'Mark complete'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
