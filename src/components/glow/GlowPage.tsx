'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BackgroundShell } from '../layout/BackgroundShell';
import { RoutineCard } from './RoutineCard';
import { BooksShelf } from './BooksShelf';
import { PolaroidCard } from './PolaroidCard';
import { PlayModeOverlay } from './PlayModeOverlay';
import { RoutineSystemModal } from './RoutineSystemModal';
import { ImageUploadModal } from './ImageUploadModal';
import { SupplementsSystemModal } from './SupplementsSystemModal';
import { DrinksSystemModal } from './DrinksSystemModal';
import { GlowActionRow } from './GlowActionRow';
import type { GlowBook, GlowImage, GlowRoutine, GlowSummary } from '../../lib/glow-types';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

type SupplementsSummary = {
  dueNow: Array<{
    log_id: number;
    scheduled_id: number;
    supplement_id: number;
    supplement_name: string;
    dosage: string | null;
    frequency_type: 'daily' | 'weekly' | 'monthly';
    times_per_day: number;
    time_of_day: 'morning' | 'evening' | 'night';
    due_time: string;
    scheduled_datetime: string;
    progress_taken: number;
    progress_total: number;
    is_missed: boolean;
    is_emergency: boolean;
  }>;
  completedToday: Array<Record<string, unknown>>;
};

type DrinksSummary = {
  dueNow: DrinkSummaryItem[];
  completedToday: DrinkSummaryItem[];
  beautyDrinkToday?: DrinkSummaryItem | null;
  beautyDrinkCompleted?: boolean;
};

type DrinkSummaryItem = {
  log_id: number;
  entry_type: 'seed_water' | 'beauty_drink';
  drink_id: number;
  drink_name: string;
  category: 'seed_water' | 'beauty_drink';
  icon_image_path: string | null;
  time_of_day: 'morning' | 'midday' | 'evening' | 'night';
  due_time: string;
  scheduled_datetime: string;
  recipe: string | null;
  seed_types: string[];
  is_missed?: boolean;
};

function routineTypeOrder(type: string): number {
  const value = type.trim().toLowerCase();
  if (value.includes('morning')) return 0;
  if (value.includes('midday') || value.includes('afternoon')) return 1;
  if (value.includes('evening')) return 2;
  if (value.includes('night')) return 3;
  return 4;
}

function AlbumModal({
  open,
  title,
  images,
  onClose,
  onOpenDetail,
}: {
  open: boolean;
  title: string;
  images: GlowImage[];
  onClose: () => void;
  onOpenDetail: (image: GlowImage) => void;
}) {
  const [mounted, setMounted] = useState(false);
  usePlatformWindowOpen(open);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex h-[min(86vh,760px)] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">Close</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-2">
          <div className="flex flex-wrap gap-4">
            {images.map((image) => (
              <PolaroidCard key={image.id} image={image} onOpen={() => onOpenDetail(image)} />
            ))}
            {images.length === 0 && <p className="font-sans text-sm text-[#B9B4D9]">No polaroids in this book yet.</p>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PolaroidDetailModal({ image, onClose }: { image: GlowImage | null; onClose: () => void }) {
  const open = Boolean(image);
  const [mounted, setMounted] = useState(false);
  usePlatformWindowOpen(open);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted || !image) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.62)] p-4">
        <img src={image.image_path} alt={image.caption ?? 'Polaroid'} className="h-72 w-full rounded-xl object-cover" />
        <p className="mt-3 font-serif text-2xl text-[#F8F4FF]">{image.caption || 'Glow moment'}</p>
        {image.quote && <p className="mt-1 font-sans text-sm text-[#B9B4D9]">“{image.quote}”</p>}
        <p className="mt-1 font-sans text-xs text-[#B9B4D9]">{image.routine_name ?? 'Routine'} • {new Date(image.created_at).toLocaleDateString('en-GB')}</p>
        <button type="button" onClick={onClose} className="mt-3 rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">Close</button>
      </div>
    </div>,
    document.body,
  );
}

function AddBookModal({
  open,
  onClose,
  onCreated,
  books,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
  books: GlowBook[];
}) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookTitles, setBookTitles] = useState<Record<number, string>>({});
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  usePlatformWindowOpen(open);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const next: Record<number, string> = {};
    for (const book of books) next[book.id] = book.title;
    setBookTitles(next);
  }, [open, books]);
  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4 backdrop-blur-xl">
        <h3 className="font-serif text-2xl text-[#F8F4FF]">Add Book</h3>
        <form
          className="mt-3 space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const iconInput = form.elements.namedItem('icon') as HTMLInputElement;
            const file = iconInput?.files?.[0];
            if (!title.trim() || !file) return;

            setSaving(true);
            const formData = new FormData();
            formData.set('title', title.trim());
            formData.set('icon', file);
            await fetch('/api/glow/books/create', { method: 'POST', body: formData });
            setSaving(false);
            setTitle('');
            await onCreated();
            onClose();
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Book title"
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm text-[#F8F4FF]"
          />
          <input
            name="icon"
            type="file"
            accept="image/*"
            required
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm text-[#F8F4FF]"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1 text-xs text-[#F8F4FF]">{saving ? 'Saving...' : 'Save Book'}</button>
            <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-4 py-1 text-xs text-[#F8F4FF]">Cancel</button>
          </div>
        </form>

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="font-sans text-xs uppercase tracking-[0.16em] text-[#B9B4D9]">Edit Books</p>
          <div className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
            {books.length === 0 ? (
              <p className="font-sans text-sm text-[#B9B4D9]">No books yet.</p>
            ) : (
              books.map((book) => (
                <form
                  key={book.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const iconInput = form.elements.namedItem(`icon-${book.id}`) as HTMLInputElement;
                    const file = iconInput?.files?.[0];
                    const nextTitle = (bookTitles[book.id] ?? '').trim();
                    if (!nextTitle) return;
                    setUpdatingId(book.id);
                    const formData = new FormData();
                    formData.set('title', nextTitle);
                    if (file) formData.set('icon', file);
                    await fetch(`/api/glow/books/${book.id}`, { method: 'PATCH', body: formData });
                    setUpdatingId(null);
                    await onCreated();
                  }}
                >
                  <div className="flex items-center gap-2">
                    <img src={book.icon_path} alt={book.title} className="h-10 w-10 rounded-md border border-white/10 object-cover" />
                    <p className="min-w-0 flex-1 truncate font-sans text-sm text-[#F8F4FF]">{book.title}</p>
                    <button
                      type="button"
                      onClick={() => setEditingBookId((prev) => (prev === book.id ? null : book.id))}
                      className="rounded-full border border-[#C084FC66] bg-[#C084FC22] px-3 py-1 text-xs text-[#F8F4FF]"
                    >
                      {editingBookId === book.id ? 'Close' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === book.id}
                      onClick={async () => {
                        setDeletingId(book.id);
                        await fetch(`/api/glow/books/${book.id}`, { method: 'DELETE' });
                        setDeletingId(null);
                        if (editingBookId === book.id) setEditingBookId(null);
                        await onCreated();
                      }}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]"
                    >
                      {deletingId === book.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                  {editingBookId === book.id && (
                    <div className="mt-2 space-y-2">
                      <input
                        value={bookTitles[book.id] ?? book.title}
                        onChange={(e) => setBookTitles((prev) => ({ ...prev, [book.id]: e.target.value }))}
                        className="w-full rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-sm text-[#F8F4FF]"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          name={`icon-${book.id}`}
                          type="file"
                          accept="image/*"
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-[#F8F4FF]"
                        />
                        <button type="submit" disabled={updatingId === book.id} className="rounded-full border border-[#C084FC66] bg-[#C084FC22] px-3 py-1 text-xs text-[#F8F4FF]">
                          {updatingId === book.id ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function GlowPage() {
  const [summary, setSummary] = useState<GlowSummary | null>(null);
  const [routinesAll, setRoutinesAll] = useState<GlowRoutine[]>([]);
  const [supplements, setSupplements] = useState<SupplementsSummary>({ dueNow: [], completedToday: [] });
  const [drinks, setDrinks] = useState<DrinksSummary>({ dueNow: [], completedToday: [] });
  const [loading, setLoading] = useState(true);
  const [supplementsSystemOpen, setSupplementsSystemOpen] = useState(false);
  const [drinksSystemOpen, setDrinksSystemOpen] = useState(false);
  const [completingDrinkLogs, setCompletingDrinkLogs] = useState<number[]>([]);

  const [routineSystemOpen, setRoutineSystemOpen] = useState(false);
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [playRoutine, setPlayRoutine] = useState<GlowRoutine | null>(null);
  const [uploadRoutineId, setUploadRoutineId] = useState<number | null>(null);
  const [manualUploadOpen, setManualUploadOpen] = useState(false);
  const [manualUploadBookId, setManualUploadBookId] = useState<number | null>(null);

  const [albumOpen, setAlbumOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('Book');
  const [albumImages, setAlbumImages] = useState<GlowImage[]>([]);

  const [detailImage, setDetailImage] = useState<GlowImage | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/glow/summary', { cache: 'no-store' });
      const payload = (await response.json()) as GlowSummary;
      setSummary(payload);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoutines = useCallback(async () => {
    const response = await fetch('/api/glow/routine', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as GlowRoutine[];
    setRoutinesAll(Array.isArray(payload) ? payload : []);
  }, []);

  const loadSupplements = useCallback(async () => {
    const response = await fetch('/api/glow/supplements/today', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as SupplementsSummary;
    setSupplements(payload);
  }, []);

  const loadDrinks = useCallback(async () => {
    const response = await fetch('/api/glow/drinks/today', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = (await response.json()) as DrinksSummary;
    setDrinks(payload);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadSummary(), loadRoutines(), loadSupplements(), loadDrinks()]);
  }, [loadSummary, loadRoutines, loadSupplements, loadDrinks]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void Promise.all([loadSupplements(), loadDrinks()]);
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [loadSupplements, loadDrinks]);

  const books = useMemo(() => summary?.books ?? [], [summary?.books]);
  const scheduledRoutineCount = summary?.today_routines?.length ?? 0;
  const routinesToday = useMemo(() => {
    const source = summary?.today_routines ?? [];
    const visible = source.filter((routine) => !(routine.completed_today && routine.polaroid_uploaded_today));

    return [...visible].sort((a, b) => {
      const aStatus = a.completed_today ? 1 : 0;
      const bStatus = b.completed_today ? 1 : 0;
      if (aStatus !== bStatus) return aStatus - bStatus;

      const typeDelta = routineTypeOrder(a.type) - routineTypeOrder(b.type);
      if (typeDelta !== 0) return typeDelta;

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }, [summary?.today_routines]);

  const displayedSupplements = useMemo(
    () => [...(supplements.dueNow ?? [])].sort((a, b) => a.due_time.localeCompare(b.due_time)),
    [supplements.dueNow],
  );

  const displayedDrinks = useMemo(
    () => [...(drinks.dueNow ?? [])].sort((a, b) => a.due_time.localeCompare(b.due_time)),
    [drinks.dueNow],
  );

  const seedWaterDue = useMemo(
    () => displayedDrinks.filter((entry) => entry.entry_type === 'seed_water'),
    [displayedDrinks],
  );
  const beautyDue = useMemo(
    () => displayedDrinks.find((entry) => entry.entry_type === 'beauty_drink') ?? null,
    [displayedDrinks],
  );
  const beautyTodayItem = useMemo(
    () =>
      beautyDue ??
      drinks.beautyDrinkToday ??
      drinks.completedToday.find((entry) => entry.entry_type === 'beauty_drink') ??
      null,
    [beautyDue, drinks.beautyDrinkToday, drinks.completedToday],
  );
  const beautyDoneToday = Boolean(
    drinks.beautyDrinkCompleted ||
      (!beautyDue && drinks.completedToday.some((entry) => entry.entry_type === 'beauty_drink')),
  );
  return (
    <BackgroundShell>
      <div className="relative mx-auto flex min-h-full w-full max-w-[1400px] flex-col gap-1.5 p-3 max-[900px]:gap-1 max-[900px]:p-2">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.52)] px-4 py-2 max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-2 max-[900px]:px-2.5 max-[900px]:py-1.5">
          <Link href="/" className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[#B9B4D9]">← Back</Link>
          <div className="flex-1 max-[900px]:hidden" />
          <div className="flex flex-wrap items-center justify-end gap-2 max-[900px]:justify-start">
            <button
              type="button"
              onClick={() => setSupplementsSystemOpen(true)}
              className="rounded-full border border-[#72D3FF66] bg-[#72D3FF22] px-3 py-1 text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px]"
            >
              Supplements
            </button>
            <button
              type="button"
              onClick={() => setDrinksSystemOpen(true)}
              className="rounded-full border border-[#9F8DFF66] bg-[#9F8DFF22] px-3 py-1 text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px]"
            >
              Drinks
            </button>
            <button
              type="button"
              onClick={() => setAddBookOpen(true)}
              className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-3 py-1 text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px]"
            >
              + Book
            </button>
            <button
              type="button"
              onClick={() => setRoutineSystemOpen(true)}
              className="rounded-full border border-[#C084FC66] bg-[#C084FC22] px-4 py-1.5 text-xs text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px]"
            >
              Routine System
            </button>
          </div>
        </div>

        <section className="flex min-h-0 flex-col gap-3 pr-1">
          <div className="relative">
            {loading ? (
              <div className="shimmer h-24 w-64 rounded-full bg-white/10" />
            ) : routinesToday.length === 0 ? (
              <div className="text-center">
                <p className="font-serif text-3xl text-[#F8F4FF]">
                  {scheduledRoutineCount > 0 ? 'All routines done for now' : 'No routines scheduled for today'}
                </p>
                <button
                  type="button"
                  onClick={() => setRoutineSystemOpen(true)}
                  className="mt-3 rounded-full border border-[#C084FC66] bg-[#C084FC22] px-4 py-1.5 text-xs text-[#F8F4FF]"
                >
                  Open Routine System
                </button>
              </div>
            ) : (
              <div className="mx-auto mt-[5px] flex w-full max-w-[980px] flex-wrap items-start justify-center gap-3 max-[900px]:gap-2">
                {routinesToday.map((routine, index) => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    onStart={() => {
                      if (routine.completed_today && !routine.polaroid_uploaded_today) {
                        setUploadRoutineId(routine.id);
                        return;
                      }
                      setPlayRoutine(routine);
                    }}
                    actionLabel={routine.completed_today && !routine.polaroid_uploaded_today ? 'Save Pic' : 'Start'}
                    statusText={routine.completed_today && !routine.polaroid_uploaded_today ? 'Completed • photo pending' : undefined}
                    style={{
                      animationDelay: `${index * 0.7}s`,
                      animationDuration: `${10 + (index % 3) * 2}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pb-2">
            <div className="mt-[5px] w-full">
              <BooksShelf
                books={books}
                onOpen={async (bookId) => {
                  const book = books.find((item) => item.id === bookId);
                  setAlbumTitle(book?.title ?? 'Book Album');
                  const response = await fetch(`/api/glow/books/${bookId}/images`, { cache: 'no-store' });
                  const payload = (await response.json()) as GlowImage[];
                  setAlbumImages(Array.isArray(payload) ? payload : []);
                  setAlbumOpen(true);
                }}
                onAddPolaroid={(bookId) => {
                  if (routinesAll.length === 0) {
                    setRoutineSystemOpen(true);
                    return;
                  }
                  setManualUploadBookId(bookId);
                  setManualUploadOpen(true);
                }}
              />
            </div>

            <GlowActionRow />

            <div className="-mt-[40px] mx-auto grid w-full max-w-[980px] grid-cols-2 items-start gap-1.5 pt-0.5 max-[900px]:grid-cols-1 max-[900px]:gap-1">
              <div className="min-h-0 w-full rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-2.5 backdrop-blur-xl max-[900px]:p-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-xl text-[#F8F4FF] max-[900px]:text-lg">Supplements</h3>
                  <button
                    type="button"
                    onClick={() => setSupplementsSystemOpen(true)}
                    className="rounded-full border border-[#72D3FF66] bg-[#72D3FF22] px-2.5 py-1 text-[11px] text-[#F8F4FF]"
                  >
                    System
                  </button>
                </div>
                <div className="mt-1.5 min-h-0 h-[160px] overflow-y-auto space-y-2 pr-1">
                  {displayedSupplements.map((item) => (
                    <div
                      key={item.log_id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 ${
                        item.is_emergency
                          ? 'supplement-emergency-pulse border-[#ff2f57cc] bg-[#ff1c3d2b]'
                          : item.is_missed
                              ? 'border-[#ff6b8f88] bg-[#ff3e5c22]'
                              : 'border-white/20 bg-black/25'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`truncate font-sans text-xs ${item.is_emergency ? 'text-[#ffe6eb]' : item.is_missed ? 'text-[#ff98b5]' : 'text-[#F8F4FF]'}`}>
                          {item.supplement_name}
                          {item.dosage ? ` (${item.dosage})` : ''}
                        </p>
                        <p className={`font-sans text-[11px] ${item.is_emergency ? 'text-[#ffd3de]' : item.is_missed ? 'text-[#ffb1c8]' : 'text-[#D9D6EB]'}`}>
                          {item.due_time.slice(0, 5)}
                          {item.progress_total > 1 ? ` • ${item.progress_taken}/${item.progress_total}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          setSupplements((prev) => ({
                            ...prev,
                            dueNow: (prev.dueNow ?? []).filter((entry) => entry.log_id !== item.log_id),
                          }));
                          await fetch('/api/glow/supplements/take', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ log_id: item.log_id }),
                          });
                          await loadSupplements();
                        }}
                        className="rounded-full border border-white/25 bg-transparent px-3 py-1 text-[11px] text-[#F8F4FF]"
                      >
                        Done
                      </button>
                    </div>
                  ))}
                  {displayedSupplements.length === 0 && (
                    <p className="font-sans text-xs text-[#B9B4D9]">No due supplements right now.</p>
                  )}
                </div>
              </div>

              <div className="min-h-0 w-full rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-2.5 backdrop-blur-xl max-[900px]:p-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-xl text-[#F8F4FF] max-[900px]:text-lg">Drinks</h3>
                  <button
                    type="button"
                    onClick={() => setDrinksSystemOpen(true)}
                    className="rounded-full border border-[#9F8DFF66] bg-[#9F8DFF22] px-2.5 py-1 text-[11px] text-[#F8F4FF]"
                  >
                    System
                  </button>
                </div>
                <div className="mt-1.5 grid h-[160px] grid-cols-2 gap-2.5">
                  <div className="grid h-full place-items-center">
                    <div className="flex min-h-[110px] flex-col items-center justify-center gap-2 text-center">
                      <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-[#cae8ff]">Seed Water</span>
                      {seedWaterDue[0] ? (
                        <button
                          type="button"
                          className="rounded-full border border-white/25 bg-transparent px-3 py-1 text-[11px] text-[#F8F4FF]"
                          onClick={async () => {
                            const item = seedWaterDue[0];
                            if (!item || completingDrinkLogs.includes(item.log_id)) return;
                            setCompletingDrinkLogs((prev) => [...prev, item.log_id]);
                            await fetch('/api/glow/drinks/take', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ log_id: item.log_id, entry_type: item.entry_type }),
                            });
                            await loadDrinks();
                            setCompletingDrinkLogs((prev) => prev.filter((id) => id !== item.log_id));
                          }}
                        >
                          Done
                        </button>
                      ) : (
                        <span className="font-sans text-[11px] text-[#D9D6EB]">No due seed water</span>
                      )}
                    </div>
                  </div>

                  <div className="flex h-full items-center justify-center">
                    {beautyTodayItem ? (
                      <button
                        type="button"
                        aria-label="Log beauty drink"
                        onClick={async () => {
                          if (!beautyDue || beautyDoneToday || completingDrinkLogs.includes(beautyDue.log_id)) return;
                          setCompletingDrinkLogs((prev) => [...prev, beautyDue.log_id]);
                          await fetch('/api/glow/drinks/take', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ log_id: beautyDue.log_id, entry_type: beautyDue.entry_type }),
                          });
                          await loadDrinks();
                          setCompletingDrinkLogs((prev) => prev.filter((id) => id !== beautyDue.log_id));
                        }}
                        className="group bg-transparent p-0"
                      >
                        <img
                          src="/Images/GlowMode/drinks.png"
                          alt={beautyTodayItem.drink_name}
                          onError={(event) => {
                            (event.currentTarget as HTMLImageElement).src = '/Images/GlowWorld/drinks.png';
                          }}
                          className={`h-52 w-52 object-contain ${beautyDoneToday ? 'animate-pulse drop-shadow-[0_0_22px_rgba(113,255,174,0.95)]' : ''}`}
                        />
                      </button>
                    ) : (
                      <p className="font-sans text-xs text-[#B9B4D9]">No beauty drink today.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <RoutineSystemModal
        open={routineSystemOpen}
        routines={routinesAll}
        onClose={() => setRoutineSystemOpen(false)}
        onRefresh={refreshAll}
      />

      <SupplementsSystemModal
        open={supplementsSystemOpen}
        onClose={() => setSupplementsSystemOpen(false)}
        onUpdated={async () => {
          await loadSupplements();
        }}
      />

      <DrinksSystemModal
        open={drinksSystemOpen}
        onClose={() => setDrinksSystemOpen(false)}
        onUpdated={async () => {
          await loadDrinks();
        }}
      />

      <AddBookModal open={addBookOpen} onClose={() => setAddBookOpen(false)} onCreated={refreshAll} books={books} />

      <PlayModeOverlay
        routine={playRoutine}
        open={Boolean(playRoutine)}
        onClose={() => setPlayRoutine(null)}
        onFinished={async (routineId) => {
          setPlayRoutine(null);
          setUploadRoutineId(routineId);
          await refreshAll();
        }}
      />

      <ImageUploadModal
        open={Boolean(uploadRoutineId)}
        routineId={uploadRoutineId}
        books={books}
        onClose={() => setUploadRoutineId(null)}
        onUploaded={refreshAll}
      />

      <ImageUploadModal
        open={manualUploadOpen}
        routineId={null}
        routines={routinesAll}
        books={books}
        initialBookId={manualUploadBookId}
        onClose={() => {
          setManualUploadOpen(false);
          setManualUploadBookId(null);
        }}
        onUploaded={refreshAll}
      />

      <AlbumModal
        open={albumOpen}
        title={albumTitle}
        images={albumImages}
        onClose={() => setAlbumOpen(false)}
        onOpenDetail={(image) => setDetailImage(image)}
      />

      <PolaroidDetailModal image={detailImage} onClose={() => setDetailImage(null)} />
    </BackgroundShell>
  );
}
