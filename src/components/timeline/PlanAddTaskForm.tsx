'use client';

import { useState } from 'react';
import { EVENT_CATEGORIES } from '../../lib/events-types';
import { todayYMD } from '../../lib/timeline-helpers';

type PlanAddTaskFormProps = {
  onSaved: () => Promise<void>;
};

export function PlanAddTaskForm({ onSaved }: PlanAddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [taskDate, setTaskDate] = useState(todayYMD());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState('');
  const [checklist, setChecklist] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateChecklist = (index: number, value: string) => {
    setChecklist((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const removeChecklist = (index: number) => {
    setChecklist((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addChecklist = () => {
    setChecklist((prev) => [...prev, '']);
  };

  const save = async () => {
    if (!title.trim() || !taskDate || !startTime || !endTime) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/timeline/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          task_date: taskDate,
          start_time: startTime,
          end_time: endTime,
          category: category || undefined,
          checklist: checklist.map((i) => i.trim()).filter(Boolean),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        throw new Error(payload.message ?? 'Unable to save task.');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
      setTitle('');
      setStartTime('');
      setEndTime('');
      setCategory('');
      setChecklist(['']);
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <h4 className="font-serif text-lg text-[#F8F4FF]">Plan Task</h4>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 160))} placeholder="Title" className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF] placeholder:text-[#B9B4D9]" />
        <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF]" />
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF]" />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF]" />
      </div>

      <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF]">
        <option value="">Category (optional)</option>
        {EVENT_CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2">
        <p className="font-sans text-xs text-[#B9B4D9]">Checklist</p>
        <div className="mt-2 space-y-2">
          {checklist.map((item, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={item}
                onChange={(e) => updateChecklist(index, e.target.value.slice(0, 200))}
                placeholder={`Checklist item ${index + 1}`}
                className="flex-1 rounded-lg border border-white/10 bg-black/25 p-2 font-sans text-xs text-[#F8F4FF] placeholder:text-[#B9B4D9]"
              />
              <button
                type="button"
                onClick={() => removeChecklist(index)}
                className="rounded-full border border-white/10 px-2 py-1 font-sans text-xs text-[#B9B4D9]"
                disabled={checklist.length === 1}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addChecklist} className="mt-2 rounded-full border border-white/10 px-3 py-1 font-sans text-xs text-[#B9B4D9]">
          + Add checklist item
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !title.trim() || !taskDate || !startTime || !endTime}
          className={`rounded-full border border-[#FF3EA560] bg-[#FF3EA51A] px-4 py-1.5 font-sans text-xs text-[#F8F4FF] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#FF3EA533] ${saved ? 'animate-log-glow' : ''}`}
        >
          {saving ? 'Saving...' : 'Save Task'}
        </button>
        <span className={`font-sans text-xs text-[#FF86C8] transition-opacity duration-500 ${saved ? 'opacity-100' : 'opacity-0'}`}>
          Saved ✓
        </span>
        {error && <span className="font-sans text-xs text-[#FF86C8]">{error}</span>}
      </div>
    </section>
  );
}
