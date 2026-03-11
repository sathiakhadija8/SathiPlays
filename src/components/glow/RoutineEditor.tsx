import { useState } from 'react';
import type { GlowRoutine } from '../../lib/glow-types';

export function RoutineEditor({
  routine,
  onRefresh,
}: {
  routine: GlowRoutine | null;
  onRefresh: () => Promise<void>;
}) {
  const [taskTitle, setTaskTitle] = useState('');

  if (!routine) {
    return <p className="font-sans text-sm text-[#B9B4D9]">Select a routine to edit tasks.</p>;
  }

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    await fetch('/api/glow/routine/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routine_id: routine.id, title: taskTitle.trim() }),
    });
    setTaskTitle('');
    await onRefresh();
  };

  return (
    <div className="space-y-3">
      <h4 className="font-serif text-xl text-[#F8F4FF]">{routine.name} Tasks</h4>
      <div className="flex gap-2">
        <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Add task" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-sm text-[#F8F4FF]" />
        <button type="button" onClick={() => void addTask()} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-[#F8F4FF]">Add</button>
      </div>

      <div className="space-y-1.5">
        {routine.tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate font-sans text-sm text-[#F8F4FF]">{task.title}</span>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/glow/routine/task', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ task_id: task.id, direction: 'up' }),
                });
                await onRefresh();
              }}
              className="rounded border border-white/15 px-1.5 text-[11px] text-[#B9B4D9]"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/glow/routine/task', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ task_id: task.id, direction: 'down' }),
                });
                await onRefresh();
              }}
              className="rounded border border-white/15 px-1.5 text-[11px] text-[#B9B4D9]"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={async () => {
                await fetch(`/api/glow/routine/task?id=${task.id}`, { method: 'DELETE' });
                await onRefresh();
              }}
              className="rounded border border-white/15 px-1.5 text-[11px] text-[#B9B4D9]"
            >
              x
            </button>
          </div>
        ))}
        {routine.tasks.length === 0 && <p className="font-sans text-xs text-[#B9B4D9]">No tasks yet.</p>}
      </div>
    </div>
  );
}
