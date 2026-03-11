'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GlowRoutine } from '../../lib/glow-types';
import { RoutineEditor } from './RoutineEditor';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function RoutineSystemModal({
  open,
  routines,
  onClose,
  onRefresh,
}: {
  open: boolean;
  routines: GlowRoutine[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('Morning');
  const [days, setDays] = useState<string[]>(['Mon']);
  usePlatformWindowOpen(open);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    if (routines.length > 0) setSelectedId(routines[0].id);
  }, [open, routines]);

  const selected = useMemo(() => routines.find((item) => item.id === selectedId) ?? null, [routines, selectedId]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="flex h-[min(90vh,820px)] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)]">
        <div className="w-[42%] min-w-0 border-r border-white/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-serif text-2xl text-[#F8F4FF]">Routine System</h3>
            <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">Close</button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Routine name" className="mb-2 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-sm text-[#F8F4FF]" />
            <input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type" className="mb-2 w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-sm text-[#F8F4FF]" />
            <div className="mb-2 flex flex-wrap gap-1">
              {DAYS.map((day) => {
                const active = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDays((prev) => (prev.includes(day) ? prev.filter((v) => v !== day) : [...prev, day]))}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${active ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/20 text-[#B9B4D9]'}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!name.trim()) return;
                await fetch('/api/glow/routine', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: name.trim(), type: type.trim() || 'Routine', active_days: days }),
                });
                setName('');
                await onRefresh();
              }}
              className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-[#F8F4FF]"
            >
              Add routine
            </button>
          </div>

          <div className="mt-3 h-[calc(100%-250px)] space-y-1.5 overflow-y-auto pr-1">
            {routines.map((routine) => (
              <div key={routine.id} className={`rounded-lg border p-2 ${selectedId === routine.id ? 'border-[#C084FC66] bg-[#C084FC1A]' : 'border-white/10 bg-black/20'}`}>
                <button type="button" onClick={() => setSelectedId(routine.id)} className="w-full text-left">
                  <p className="font-sans text-sm text-[#F8F4FF]">{routine.name}</p>
                  <p className="font-sans text-xs text-[#B9B4D9]">{routine.type} • {routine.active_days.join(', ')}</p>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/glow/routine?id=${routine.id}`, { method: 'DELETE' });
                    await onRefresh();
                  }}
                  className="mt-1 rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-[#B9B4D9]"
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1 p-4">
          <RoutineEditor routine={selected} onRefresh={onRefresh} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
