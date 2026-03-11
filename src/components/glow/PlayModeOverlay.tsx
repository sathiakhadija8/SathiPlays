'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GlowRoutine } from '../../lib/glow-types';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

export function PlayModeOverlay({
  routine,
  open,
  onClose,
  onFinished,
}: {
  routine: GlowRoutine | null;
  open: boolean;
  onClose: () => void;
  onFinished: (routineId: number, result: { points_awarded: number; streak_bonus: number; current_streak: number }) => Promise<void> | void;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  usePlatformWindowOpen(open);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setCompleting(false);
    setShowFireworks(false);
  }, [open, routine?.id]);

  const task = useMemo(() => routine?.tasks?.[index] ?? null, [routine, index]);

  if (!open || !mounted || !routine) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="relative flex h-[min(86vh,720px)] w-full max-w-2xl flex-col items-center justify-center rounded-3xl border border-white/10 bg-[rgba(18,16,40,0.70)] p-6 text-center shadow-[0_0_30px_rgba(255,62,165,0.2)]">
        {showFireworks && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-[#FF3EA5] opacity-70"
                style={{ left: `${(i * 17) % 100}%`, top: `${(i * 23) % 100}%`, animationDuration: `${1.2 + (i % 4) * 0.3}s` }}
              />
            ))}
          </div>
        )}

        <p className="font-sans text-xs uppercase tracking-[0.2em] text-[#B9B4D9]">Routine Play Mode</p>
        <h2 className="mt-1 font-serif text-4xl text-[#F8F4FF]">{routine.name}</h2>

        {task ? (
          <>
            <p className="mt-6 font-sans text-sm text-[#B9B4D9]">Task {index + 1} / {routine.tasks.length}</p>
            <p className="mt-2 max-w-xl font-serif text-3xl text-[#F8F4FF]">{task.title}</p>
            <button
              type="button"
              onClick={async () => {
                if (index < routine.tasks.length - 1) {
                  setIndex((v) => v + 1);
                  return;
                }

                setCompleting(true);
                const response = await fetch('/api/glow/complete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ routine_id: routine.id }),
                });
                const payload = (await response.json()) as { points_awarded: number; streak_bonus: number; current_streak: number };

                setShowFireworks(true);
                await new Promise((resolve) => setTimeout(resolve, 1300));
                await onFinished(routine.id, {
                  points_awarded: Number(payload.points_awarded ?? 0),
                  streak_bonus: Number(payload.streak_bonus ?? 0),
                  current_streak: Number(payload.current_streak ?? routine.current_streak),
                });
                setCompleting(false);
              }}
              className="mt-7 rounded-full border border-[#FF3EA588] bg-[#FF3EA530] px-10 py-3 font-sans text-xl text-[#F8F4FF] shadow-[0_0_24px_rgba(255,62,165,0.3)] transition-all duration-200 hover:-translate-y-[1px]"
            >
              {completing ? 'Completing...' : 'Done'}
            </button>
          </>
        ) : (
          <p className="mt-8 font-sans text-sm text-[#B9B4D9]">No tasks in this routine yet.</p>
        )}

        <button type="button" onClick={onClose} className="mt-6 rounded-full border border-white/20 px-4 py-1 text-xs text-[#F8F4FF]">Close</button>
      </div>
    </div>,
    document.body,
  );
}
