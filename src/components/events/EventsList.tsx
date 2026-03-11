'use client';

import { useMemo, useState } from 'react';
import { EVENT_CATEGORIES, type EventItem } from '../../lib/events-types';
import {
  formatDateHeaderLondon,
  formatTimeLondon,
  groupEventsByDate,
  toDateInputLondon,
  toTimeInputLondon,
} from '../../lib/events-helpers';

type EventsListProps = {
  events: EventItem[];
  loading?: boolean;
  selectedDate: string | null;
  onClearFilter: () => void;
  onChanged: () => Promise<void> | void;
};

type Draft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  category: string;
};

function buildDraft(event: EventItem): Draft {
  const category = event.category && EVENT_CATEGORIES.includes(event.category as (typeof EVENT_CATEGORIES)[number]) ? event.category : '';
  return {
    title: event.title,
    date: toDateInputLondon(event.start_at),
    startTime: toTimeInputLondon(event.start_at),
    endTime: event.end_at ? toTimeInputLondon(event.end_at) : '',
    location: event.location ?? '',
    notes: event.notes ?? '',
    category,
  };
}

export function EventsList({ events, loading = false, selectedDate, onClearFilter, onChanged }: EventsListProps) {
  const grouped = groupEventsByDate(events);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canSave = useMemo(
    () => Boolean(draft?.title.trim() && draft.date && draft.startTime),
    [draft],
  );

  const startEdit = (event: EventItem) => {
    setActionError(null);
    setEditingId(event.id);
    setDraft(buildDraft(event));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = async (id: number) => {
    if (!draft) return;
    if (!canSave) {
      setActionError('Title, date, and start time are required before saving.');
      return;
    }
    setSavingId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          start_at: `${draft.date} ${draft.startTime}:00`,
          end_at: draft.endTime ? `${draft.date} ${draft.endTime}:00` : undefined,
          location: draft.location.trim() || undefined,
          notes: draft.notes.trim() || undefined,
          category: draft.category || undefined,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        let message = 'Unable to save event changes.';
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
      cancelEdit();
      try {
        await Promise.resolve(onChanged());
      } catch {
        setActionError('Event saved, but the list could not refresh. Reopen Events to sync.');
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to save event changes.');
    } finally {
      setSavingId(null);
    }
  };

  const deleteEvent = async (id: number) => {
    const confirmed = window.confirm('Delete this event?');
    if (!confirmed) return;
    setDeletingId(id);
    setActionError(null);
    try {
      const response = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const text = await response.text();
        let message = 'Unable to delete event.';
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
      if (editingId === id) cancelEdit();
      try {
        await Promise.resolve(onChanged());
      } catch {
        setActionError('Event deleted, but the list could not refresh. Reopen Events to sync.');
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to delete event.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-serif text-lg text-[#F8F4FF]">Events</h4>
        {selectedDate && (
          <button
            type="button"
            onClick={onClearFilter}
            className="rounded-full border border-white/10 px-2 py-1 font-sans text-xs text-[#B9B4D9] transition-all duration-300 hover:-translate-y-[1px] hover:text-[#F8F4FF]"
          >
            Clear filter
          </button>
        )}
      </div>
      {actionError && <p className="mb-2 font-sans text-xs text-[#FF86C8]">{actionError}</p>}

      <div className="h-[280px] overflow-y-auto pr-1">
        {loading ? (
          <div className="shimmer h-full w-full rounded-xl bg-white/10" />
        ) : events.length === 0 ? (
          <p className="font-sans text-sm text-[#B9B4D9]">No events in this view.</p>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => (
              <div key={group.date}>
                <p className="mb-1 font-sans text-xs text-[#B9B4D9]">{formatDateHeaderLondon(group.date)}</p>
                <ul className="space-y-2">
                  {group.items.map((event) => {
                    const isEditing = editingId === event.id && draft;
                    return (
                      <li key={event.id} className="rounded-xl border border-white/10 bg-black/25 p-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              value={draft.title}
                              onChange={(e) => setDraft({ ...draft, title: e.target.value.slice(0, 120) })}
                              className="w-full rounded-lg border border-white/10 bg-black/20 p-2 font-sans text-xs text-[#F8F4FF]"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="rounded-lg border border-white/10 bg-black/20 p-2 font-sans text-xs text-[#F8F4FF]" />
                              <input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} className="rounded-lg border border-white/10 bg-black/20 p-2 font-sans text-xs text-[#F8F4FF]" />
                              <input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} className="rounded-lg border border-white/10 bg-black/20 p-2 font-sans text-xs text-[#F8F4FF]" />
                              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded-lg border border-white/10 bg-black/20 p-2 font-sans text-xs text-[#F8F4FF]">
                                <option value="">No category</option>
                                {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value.slice(0, 120) })} placeholder="Location" className="w-full rounded-lg border border-white/10 bg-black/20 p-2 font-sans text-xs text-[#F8F4FF]" />
                            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" className="h-16 w-full rounded-lg border border-white/10 bg-black/20 p-2 font-sans text-xs text-[#F8F4FF]" />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => saveEdit(event.id)} disabled={savingId === event.id} className="rounded-full border border-[#FF3EA560] bg-[#FF3EA51A] px-3 py-1 font-sans text-[11px] text-[#F8F4FF]">
                                {savingId === event.id ? 'Saving...' : 'Save'}
                              </button>
                              <button type="button" onClick={cancelEdit} className="rounded-full border border-white/10 px-3 py-1 font-sans text-[11px] text-[#B9B4D9]">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="font-sans text-xs text-[#B9B4D9]">
                              {formatTimeLondon(event.start_at)}
                              {event.end_at ? ` - ${formatTimeLondon(event.end_at)}` : ''}
                            </p>
                            <p className="font-sans text-sm text-[#F8F4FF]">{event.title}</p>
                            {event.location && <p className="font-sans text-xs text-[#B9B4D9]">{event.location}</p>}
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {event.category && (
                                  <span className="inline-block rounded-full bg-[#FF3EA522] px-2 py-0.5 font-sans text-[10px] text-[#F8F4FF]">
                                    {event.category}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <button type="button" onClick={() => startEdit(event)} className="rounded-full border border-white/10 px-2 py-0.5 font-sans text-[10px] text-[#B9B4D9]">Edit</button>
                                <button type="button" onClick={() => deleteEvent(event.id)} disabled={deletingId === event.id} className="rounded-full border border-[#FF3EA560] px-2 py-0.5 font-sans text-[10px] text-[#FF86C8]">
                                  {deletingId === event.id ? '...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
