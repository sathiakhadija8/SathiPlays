'use client';

import { useMemo, useState } from 'react';
import { EVENT_CATEGORIES } from '../../lib/events-types';
import { londonTodayYMD } from '../../lib/events-helpers';

type AddEventFormProps = {
  onSaved: (savedDate: string) => Promise<void> | void;
};

export function AddEventForm({ onSaved }: AddEventFormProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(londonTodayYMD());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => Boolean(title.trim() && date && startTime), [title, date, startTime]);

  const submit = async () => {
    if (!canSubmit) {
      setError('Title, date, and start time are required.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        start_at: `${date} ${startTime}:00`,
        end_at: endTime ? `${date} ${endTime}:00` : undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        category: category || undefined,
      };

      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        let message = 'Unable to save event.';
        if (text) {
          try {
            const parsed = JSON.parse(text) as { message?: string };
            if (parsed?.message) message = parsed.message;
          } catch {
            message = text.slice(0, 180);
          }
        }
        throw new Error(message);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 1300);
      setTitle('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setNotes('');
      setCategory('');
      try {
        await Promise.resolve(onSaved(date));
      } catch {
        // Do not mark create as failed when only the refresh fails.
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <h4 className="font-serif text-lg text-[#F8F4FF]">Add Event</h4>
      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="Title" className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF] placeholder:text-[#B9B4D9]" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF]" />
        <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF]" />
        <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF]" />
        <input value={location} onChange={(e) => setLocation(e.target.value.slice(0, 120))} placeholder="Location (optional)" className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF] placeholder:text-[#B9B4D9]" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF]">
          <option value="">Category (optional)</option>
          {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="mt-2 h-20 w-full rounded-xl border border-white/10 bg-black/25 p-2 font-sans text-sm text-[#F8F4FF] placeholder:text-[#B9B4D9]" />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className={`rounded-full border border-[#FF3EA560] bg-[#FF3EA51A] px-4 py-1.5 font-sans text-xs text-[#F8F4FF] transition-all duration-300 hover:-translate-y-[1px] hover:bg-[#FF3EA533] ${saved ? 'animate-log-glow' : ''}`}
        >
          {saving ? 'Saving...' : 'Save Event'}
        </button>
        <span className={`font-sans text-xs text-[#FF86C8] transition-opacity duration-500 ${saved ? 'opacity-100' : 'opacity-0'}`}>Saved ✓</span>
        {error && <span className="font-sans text-xs text-[#FF86C8]">{error}</span>}
      </div>
    </section>
  );
}
