'use client';

import { useEffect, useMemo, useState } from 'react';
import { MultiImageUpload } from '../shared/MultiImageUpload';
import type { TripItem, TripStatus } from './TripGrid';
import { toPersistableImageUrl, toPersistableImageUrls } from '../../utils/imageUrls';

const STATUS_OPTIONS: TripStatus[] = ['dream', 'upcoming', 'completed'];

type ReminderItem = {
  id: string;
  title: string;
  notes: string;
  reminderType: 'countdown' | 'checkin' | 'gate' | 'hotel' | 'refund' | 'custom';
  remindAt: string;
  isDone: boolean;
};

type MemoryItem = {
  id: string;
  title: string;
  notes: string;
  memoryDate: string;
  rating: number | null;
  photos: string[];
};

type BookingItem = {
  id: string;
  bookingType: 'flight' | 'hotel' | 'train' | 'activity' | 'other';
  title: string;
  provider: string;
  referenceCode: string;
  startAt: string;
  checkinAt: string;
  gateAt: string;
  hotelWindowStartAt: string;
  hotelWindowEndAt: string;
  refundDeadlineAt: string;
};

type BudgetInsights = {
  planned: number;
  spent: number;
  remaining: number;
  totalDays: number;
  elapsedDays: number;
  targetDaily: number;
  actualDaily: number;
  paceDelta: number;
  paceStatus: 'over' | 'under' | 'on-track';
  categoryBreakdown: Array<{ category: string; amount: number }>;
};

export function TripDetail({
  trip,
  onBack,
  onSave,
}: {
  trip: TripItem;
  onBack: () => void;
  onSave: (trip: TripItem) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<TripItem>(trip);
  const [newPlace, setNewPlace] = useState('');

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [budgetInsights, setBudgetInsights] = useState<BudgetInsights | null>(null);
  const [travelLoading, setTravelLoading] = useState(false);

  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderAt, setNewReminderAt] = useState('');
  const [newMemoryTitle, setNewMemoryTitle] = useState('');
  const [newMemoryNotes, setNewMemoryNotes] = useState('');
  const [newMemoryRating, setNewMemoryRating] = useState('5');
  const [forgottenDraft, setForgottenDraft] = useState('');

  const [bookingTitle, setBookingTitle] = useState('');
  const [bookingType, setBookingType] = useState<BookingItem['bookingType']>('flight');
  const [bookingStartAt, setBookingStartAt] = useState('');
  const [bookingCheckinAt, setBookingCheckinAt] = useState('');
  const [bookingGateAt, setBookingGateAt] = useState('');
  const [bookingHotelStartAt, setBookingHotelStartAt] = useState('');
  const [bookingHotelEndAt, setBookingHotelEndAt] = useState('');
  const [bookingRefundAt, setBookingRefundAt] = useState('');

  useEffect(() => {
    setDraft(trip);
  }, [trip]);

  const loadTravelSideData = async () => {
    setTravelLoading(true);
    try {
      const [remindersResponse, memoriesResponse, bookingsResponse, budgetInsightsResponse] = await Promise.all([
        fetch(`/api/travel/reminders?tripId=${encodeURIComponent(trip.id)}`, { cache: 'no-store' }),
        fetch(`/api/travel/memories?tripId=${encodeURIComponent(trip.id)}`, { cache: 'no-store' }),
        fetch(`/api/travel/bookings?tripId=${encodeURIComponent(trip.id)}`, { cache: 'no-store' }),
        fetch(`/api/travel/budget-insights?tripId=${encodeURIComponent(trip.id)}`, { cache: 'no-store' }),
      ]);
      const remindersPayload = (await remindersResponse.json()) as ReminderItem[];
      const memoriesPayload = (await memoriesResponse.json()) as MemoryItem[];
      const bookingsPayload = (await bookingsResponse.json()) as BookingItem[];
      const budgetPayload = (await budgetInsightsResponse.json()) as BudgetInsights;

      setReminders(Array.isArray(remindersPayload) ? remindersPayload : []);
      setMemories(Array.isArray(memoriesPayload) ? memoriesPayload : []);
      setBookings(Array.isArray(bookingsPayload) ? bookingsPayload : []);
      setBudgetInsights(budgetPayload && typeof budgetPayload === 'object' ? budgetPayload : null);
    } catch {
      setReminders([]);
      setMemories([]);
      setBookings([]);
      setBudgetInsights(null);
    } finally {
      setTravelLoading(false);
    }
  };

  useEffect(() => {
    void loadTravelSideData();
  }, [trip.id]);

  const budgetDiff = useMemo(() => Number(draft.plannedBudget) - Number(draft.spentBudget), [draft]);

  const handleSave = async () => {
    const persistableCoverImage = await toPersistableImageUrl(draft.coverImage);
    const persistableGallery = await toPersistableImageUrls(draft.gallery);
    await onSave({
      ...draft,
      coverImage: persistableCoverImage,
      gallery: persistableGallery,
    });
  };

  const addReminder = async () => {
    if (!newReminderTitle.trim() || !newReminderAt) return;
    await fetch('/api/travel/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: draft.id,
        reminderType: 'custom',
        title: newReminderTitle.trim(),
        remindAt: newReminderAt,
      }),
    });
    setNewReminderTitle('');
    setNewReminderAt('');
    await loadTravelSideData();
  };

  const generateMilestones = async () => {
    await fetch('/api/travel/reminders/auto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: draft.id }),
    });
    await loadTravelSideData();
  };

  const toggleReminderDone = async (item: ReminderItem) => {
    await fetch(`/api/travel/reminders/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: item.title,
        notes: item.notes,
        reminderType: item.reminderType,
        remindAt: item.remindAt,
        isDone: !item.isDone,
      }),
    });
    setReminders((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, isDone: !entry.isDone } : entry)));
  };

  const addMemory = async () => {
    if (!newMemoryTitle.trim()) return;
    await fetch('/api/travel/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: draft.id,
        memoryDate: new Date().toISOString().slice(0, 10),
        title: newMemoryTitle.trim(),
        notes: newMemoryNotes.trim(),
        rating: Number(newMemoryRating || 5),
        photos: [],
      }),
    });
    setNewMemoryTitle('');
    setNewMemoryNotes('');
    setNewMemoryRating('5');
    await loadTravelSideData();
  };

  const saveForgottenItems = async () => {
    const values = forgottenDraft
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (values.length === 0) return;
    await fetch('/api/travel/forgotten-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId: draft.id, items: values }),
    });
    setForgottenDraft('');
  };

  const addBooking = async () => {
    if (!bookingTitle.trim()) return;
    await fetch('/api/travel/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripId: draft.id,
        bookingType,
        title: bookingTitle.trim(),
        startAt: bookingStartAt || null,
        checkinAt: bookingCheckinAt || null,
        gateAt: bookingGateAt || null,
        hotelWindowStartAt: bookingHotelStartAt || null,
        hotelWindowEndAt: bookingHotelEndAt || null,
        refundDeadlineAt: bookingRefundAt || null,
      }),
    });
    setBookingTitle('');
    setBookingStartAt('');
    setBookingCheckinAt('');
    setBookingGateAt('');
    setBookingHotelStartAt('');
    setBookingHotelEndAt('');
    setBookingRefundAt('');
    await loadTravelSideData();
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[#d4e6ff2f] bg-[linear-gradient(180deg,rgba(187,220,255,0.14),rgba(141,180,230,0.06))] p-3">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[#d7e6ff33] bg-[rgba(201,222,255,0.12)] px-3 py-1 text-xs text-[#F2F7FF]"
        >
          ← Back
        </button>

        <div className="text-center">
          <h3 className="font-serif text-2xl text-[#F2F7FF]">
            {draft.city}, {draft.country}
          </h3>
          <p className="text-xs text-[#C9D9EE]">
            {draft.startDate} - {draft.endDate}{typeof draft.duration_days === 'number' ? ` • ${draft.duration_days} days` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-3 py-1 text-xs text-[#EEF6FF]"
        >
          Save
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-serif text-xl text-[#F2F7FF]">📸 Gallery</h4>
              <select
                value={draft.status}
                onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value as TripStatus }))}
                className="h-8 rounded-full border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status} className="bg-[#17263b]">
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <img src={draft.coverImage || '/Images/background.png'} alt="Trip cover" className="mb-3 h-40 w-full rounded-xl object-cover" />

            <MultiImageUpload
              value={draft.gallery}
              onChange={(next) => setDraft((prev) => ({ ...prev, gallery: next }))}
              label="Trip gallery"
              buttonLabel="+ Add photos"
              className="border-[#d8e8fb44] bg-[rgba(12,23,40,0.3)]"
            />
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
            <h4 className="font-serif text-xl text-[#F2F7FF]">📝 Reflection</h4>
            <textarea
              value={draft.reflection}
              onChange={(event) => setDraft((prev) => ({ ...prev, reflection: event.target.value }))}
              rows={7}
              className="mt-2 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 py-2 text-sm text-[#F2F7FF] outline-none"
              placeholder="How did this trip feel?"
            />
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
            <h4 className="font-serif text-xl text-[#F2F7FF]">💰 Budget Overview</h4>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>Planned</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.plannedBudget}
                  onChange={(event) => setDraft((prev) => ({ ...prev, plannedBudget: Number(event.target.value || 0) }))}
                  className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
                />
              </label>
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>Spent</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.spentBudget}
                  onChange={(event) => setDraft((prev) => ({ ...prev, spentBudget: Number(event.target.value || 0) }))}
                  className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
                />
              </label>
            </div>
            <p className="mt-3 text-sm text-[#D9E9FB]">
              {budgetDiff >= 0 ? 'Remaining' : 'Over'}: <span className="font-semibold">£{Math.abs(budgetDiff).toFixed(2)}</span>
            </p>
            {budgetInsights ? (
              <div className="mt-3 rounded-xl border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] p-2 text-xs text-[#D8E8FB]">
                <p>
                  Pace: <span className="font-semibold">{budgetInsights.paceStatus}</span> ({budgetInsights.actualDaily.toFixed(2)}/day vs {budgetInsights.targetDaily.toFixed(2)}/day target)
                </p>
                <p className="mt-1">
                  Elapsed: {budgetInsights.elapsedDays}/{budgetInsights.totalDays} days
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {budgetInsights.categoryBreakdown.map((entry) => (
                    <span key={entry.category} className="rounded-full border border-[#d7e6ff33] px-2 py-0.5">
                      {entry.category}: £{entry.amount.toFixed(0)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
            <h4 className="font-serif text-xl text-[#F2F7FF]">📍 Places visited</h4>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const value = newPlace.trim();
                if (!value) return;
                setDraft((prev) => ({ ...prev, placesVisited: [...prev.placesVisited, value] }));
                setNewPlace('');
              }}
              className="mt-2 flex gap-2"
            >
              <input
                value={newPlace}
                onChange={(event) => setNewPlace(event.target.value)}
                placeholder="Add a place"
                className="h-10 flex-1 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
              />
              <button
                type="submit"
                className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-3 py-1 text-sm text-[#EEF6FF]"
              >
                Add
              </button>
            </form>

            <div className="mt-3 max-h-36 overflow-y-auto pr-1">
              {draft.placesVisited.length === 0 ? (
                <p className="text-xs text-[#ACC4E1]">No places added yet.</p>
              ) : (
                <ul className="space-y-2">
                  {draft.placesVisited.map((place, index) => (
                    <li
                      key={`${place}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] px-2 py-1.5 text-sm text-[#EAF2FF]"
                    >
                      <span className="truncate">{place}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            placesVisited: prev.placesVisited.filter((_, i) => i !== index),
                          }))
                        }
                        className="ml-2 rounded-full border border-[#d7e6ff33] px-2 py-0.5 text-[11px] text-[#D8E8FB]"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3 lg:col-span-2">
            <h4 className="font-serif text-xl text-[#F2F7FF]">🎟️ Bookings</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <select value={bookingType} onChange={(event) => setBookingType(event.target.value as BookingItem['bookingType'])} className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-2 text-xs text-[#F2F7FF]">
                {['flight', 'hotel', 'train', 'activity', 'other'].map((type) => <option key={type} value={type} className="bg-[#17263b]">{type}</option>)}
              </select>
              <input value={bookingTitle} onChange={(event) => setBookingTitle(event.target.value)} placeholder="Booking title" className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none" />
              <input type="datetime-local" value={bookingStartAt} onChange={(event) => setBookingStartAt(event.target.value)} className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none" />
              <input type="datetime-local" value={bookingCheckinAt} onChange={(event) => setBookingCheckinAt(event.target.value)} className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none" />
              <input type="datetime-local" value={bookingGateAt} onChange={(event) => setBookingGateAt(event.target.value)} className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none" />
              <input type="datetime-local" value={bookingHotelStartAt} onChange={(event) => setBookingHotelStartAt(event.target.value)} className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none" />
              <input type="datetime-local" value={bookingHotelEndAt} onChange={(event) => setBookingHotelEndAt(event.target.value)} className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none" />
              <input type="datetime-local" value={bookingRefundAt} onChange={(event) => setBookingRefundAt(event.target.value)} className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none" />
              <button type="button" onClick={() => void addBooking()} className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-3 py-1 text-xs text-[#EEF6FF]">
                Save Booking
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {bookings.length === 0 ? <p className="text-xs text-[#ACC4E1]">No bookings yet.</p> : null}
              {bookings.map((booking) => (
                <article key={booking.id} className="rounded-lg border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] px-2 py-1.5">
                  <p className="text-sm text-[#EAF2FF]">{booking.title} • {booking.bookingType}</p>
                  <p className="text-[11px] text-[#BFD3EC]">{booking.startAt ? `Start: ${String(booking.startAt).replace('T', ' ')}` : 'No start time'}{booking.checkinAt ? ` • Check-in: ${String(booking.checkinAt).replace('T', ' ')}` : ''}</p>
                  <p className="text-[11px] text-[#BFD3EC]">{booking.gateAt ? `Gate: ${String(booking.gateAt).replace('T', ' ')}` : ''}{booking.hotelWindowStartAt ? ` • Hotel open: ${String(booking.hotelWindowStartAt).replace('T', ' ')}` : ''}{booking.hotelWindowEndAt ? ` • Hotel close: ${String(booking.hotelWindowEndAt).replace('T', ' ')}` : ''}</p>
                  <p className="text-[11px] text-[#BFD3EC]">{booking.refundDeadlineAt ? `Refund: ${String(booking.refundDeadlineAt).replace('T', ' ')}` : 'No refund deadline'}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-serif text-xl text-[#F2F7FF]">⏰ Logistics Reminders</h4>
              {travelLoading ? <span className="text-[11px] text-[#B7CAE2]">Loading...</span> : null}
            </div>
            <div className="mb-2 flex flex-wrap gap-2">
              <input
                value={newReminderTitle}
                onChange={(event) => setNewReminderTitle(event.target.value)}
                placeholder="Reminder title (check-in, gate, hotel...)"
                className="h-9 min-w-[220px] flex-1 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none"
              />
              <input
                type="datetime-local"
                value={newReminderAt}
                onChange={(event) => setNewReminderAt(event.target.value)}
                className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none"
              />
              <button type="button" onClick={() => void addReminder()} className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-3 py-1 text-xs text-[#EEF6FF]">
                Add
              </button>
              <button type="button" onClick={() => void generateMilestones()} className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-3 py-1 text-xs text-[#EEF6FF]">
                Generate Milestones
              </button>
            </div>
            <div className="space-y-1.5">
              {reminders.length === 0 ? <p className="text-xs text-[#ACC4E1]">No reminders yet.</p> : null}
              {reminders.map((reminder) => (
                <label key={reminder.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] px-2 py-1.5">
                  <div className="min-w-0">
                    <p className={`truncate text-sm ${reminder.isDone ? 'text-[#9db8d4] line-through' : 'text-[#EAF2FF]'}`}>{reminder.title}</p>
                    <p className="text-[11px] text-[#BFD3EC]">{String(reminder.remindAt).replace('T', ' ')}</p>
                  </div>
                  <input type="checkbox" checked={reminder.isDone} onChange={() => void toggleReminderDone(reminder)} />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3 lg:col-span-2">
            <h4 className="font-serif text-xl text-[#F2F7FF]">📚 Memory Mode</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1.2fr_2fr_120px_auto]">
              <input
                value={newMemoryTitle}
                onChange={(event) => setNewMemoryTitle(event.target.value)}
                placeholder="Memory title"
                className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none"
              />
              <input
                value={newMemoryNotes}
                onChange={(event) => setNewMemoryNotes(event.target.value)}
                placeholder="Reflection"
                className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none"
              />
              <select value={newMemoryRating} onChange={(event) => setNewMemoryRating(event.target.value)} className="h-9 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n} className="bg-[#17263b]">{n}★</option>)}
              </select>
              <button type="button" onClick={() => void addMemory()} className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-3 py-1 text-xs text-[#EEF6FF]">
                Add Memory
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {memories.length === 0 ? <p className="text-xs text-[#ACC4E1]">No memories yet.</p> : null}
              {memories.map((memory) => (
                <article key={memory.id} className="rounded-lg border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] px-2 py-1.5">
                  <p className="text-sm text-[#EAF2FF]">{memory.title} {memory.rating ? `• ${memory.rating}★` : ''}</p>
                  <p className="text-[11px] text-[#BFD3EC]">{memory.notes}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3 lg:col-span-2">
            <h4 className="font-serif text-xl text-[#F2F7FF]">🧠 Forgot Last Time</h4>
            <p className="mt-1 text-xs text-[#ACC4E1]">Comma-separated items you forgot. They'll auto-appear in future packing plans.</p>
            <div className="mt-2 flex gap-2">
              <input
                value={forgottenDraft}
                onChange={(event) => setForgottenDraft(event.target.value)}
                placeholder="example: adapter, medicine pouch, power bank"
                className="h-9 flex-1 rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-xs text-[#F2F7FF] outline-none"
              />
              <button type="button" onClick={() => void saveForgottenItems()} className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-3 py-1 text-xs text-[#EEF6FF]">
                Save
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
