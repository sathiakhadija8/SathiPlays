'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import type { CultureItem } from './CultureCard';
import type { CultureType } from './CultureTabs';

const LANGUAGES = ['Korean', 'Turkish', 'Bollywood', 'Hindi', 'English', 'British', 'Other'] as const;
const GENRES = ['Romance', 'Psychological', 'Thriller', 'Crime', 'Drama', 'Comedy', 'Fantasy', 'Sci-Fi', 'Historical', 'Documentary', 'Action'] as const;

const BOOK_MOODS = ['Cozy', 'Dark', 'Intense', 'Romantic', 'Thought-provoking', 'Emotional', 'Other'] as const;
const BOOK_STATUS = ['Reading', 'Completed', 'Paused'] as const;
const SERIES_STATUS = ['Watching', 'Completed', 'Dropped'] as const;

type Draft = {
  title: string;
  type: CultureType;
  in_wishlist: boolean;
  image_url: string;
  language: string;
  genres: string[];
  category_kind: 'fiction' | 'deen';
  date_completed: string;
  review_text: string;
  rating: string;
  total_pages: string;
  pages_read: string;
  mood: string;
  status: string;
  seasons_watched: string;
  episodes_watched: string;
};

function buildDraft(activeType: CultureType, entry?: CultureItem | null): Draft {
  const baseType = entry?.type ?? activeType;
  const defaultStatus = baseType === 'book' ? 'Reading' : '';
  return {
    title: entry?.title ?? '',
    type: baseType,
    in_wishlist: Boolean(entry?.in_wishlist),
    image_url: entry?.image_url ?? '',
    language: entry?.language ?? '',
    genres: entry?.genres ?? [],
    category_kind: entry?.category_kind === 'deen' ? 'deen' : 'fiction',
    date_completed: entry?.date_completed ? entry.date_completed.slice(0, 10) : '',
    review_text: entry?.review_text ?? '',
    rating: entry?.rating != null ? String(entry.rating) : '',
    total_pages: entry?.total_pages != null ? String(entry.total_pages) : '',
    pages_read: entry?.pages_read != null ? String(entry.pages_read) : '',
    mood: entry?.mood ?? '',
    status: entry?.status ?? defaultStatus,
    seasons_watched: entry?.seasons_watched != null ? String(entry.seasons_watched) : '',
    episodes_watched: entry?.episodes_watched != null ? String(entry.episodes_watched) : '',
  };
}

function validate(draft: Draft, hasSelectedFile: boolean) {
  const errors: Record<string, string> = {};

  if (!draft.title.trim()) errors.title = 'Title is required.';
  if (!draft.language.trim()) errors.language = 'Language is required.';
  if (!draft.image_url.trim() && !hasSelectedFile) errors.image_url = 'Image is required (URL or file).';

  if (draft.type === 'book') {
    const totalPages = Number(draft.total_pages);
    const pagesRead = Number(draft.pages_read);

    if (!Number.isFinite(totalPages) || totalPages < 1) {
      errors.total_pages = 'Total pages must be at least 1.';
    }
    if (!Number.isFinite(pagesRead) || pagesRead < 0) {
      errors.pages_read = 'Pages read must be 0 or more.';
    }
    if (Number.isFinite(totalPages) && Number.isFinite(pagesRead) && pagesRead > totalPages) {
      errors.pages_read = 'Pages read cannot exceed total pages.';
    }
    if (!draft.mood.trim()) errors.mood = 'Mood is required for books.';
    if (!draft.status.trim()) errors.status = 'Status is required for books.';
    if (draft.status === 'Completed' && !draft.date_completed) {
      errors.date_completed = 'Date completed is required when status is Completed.';
    }

    if (draft.status !== 'Completed' && draft.rating.trim()) {
      errors.rating = 'Rating is only enabled when status is Completed.';
    }
    if (draft.category_kind === 'deen' && draft.genres.length > 0) {
      errors.genres = 'Deen books do not use genres.';
    }
  }

  return errors;
}

export function CultureEntryModal({
  open,
  activeType,
  editingEntry,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  activeType: CultureType;
  editingEntry: CultureItem | null;
  onClose: () => void;
  onCreate: (entry: CultureItem) => void;
  onUpdate: (entry: CultureItem) => void;
}) {
  usePlatformWindowOpen(open);

  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => buildDraft(activeType, editingEntry));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setDraft(buildDraft(activeType, editingEntry));
    setSelectedFile(null);
    setErrors({});
  }, [open, activeType, editingEntry]);

  const isEditing = Boolean(editingEntry);

  const previewUrl = useMemo(() => {
    if (draft.image_url.trim()) return draft.image_url.trim();
    if (selectedFile) return URL.createObjectURL(selectedFile);
    return '';
  }, [draft.image_url, selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!mounted || !open) return null;

  const save = (forceWishlist?: boolean) => {
    const nextErrors = validate(draft, Boolean(selectedFile));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const normalizedImage = draft.image_url.trim() || (selectedFile ? URL.createObjectURL(selectedFile) : '');
    const normalized: CultureItem = {
      id: editingEntry?.id ?? Date.now(),
      title: draft.title.trim(),
      type: draft.type,
      image_url: normalizedImage,
      language: draft.language,
      genres: draft.type === 'book' && draft.category_kind === 'deen' ? [] : draft.genres,
      category_kind: draft.type === 'book' ? draft.category_kind : null,
      in_wishlist: forceWishlist ?? draft.in_wishlist,
      rating: draft.rating.trim() ? Number(draft.rating) : null,
      review_text: draft.review_text.trim() || null,
      date_started: editingEntry?.date_started ?? null,
      date_completed: draft.date_completed || null,
      status: draft.status || null,
      seasons_watched: draft.seasons_watched ? Number(draft.seasons_watched) : null,
      episodes_watched: draft.episodes_watched ? Number(draft.episodes_watched) : null,
      author: editingEntry?.author ?? null,
      total_pages: draft.total_pages ? Number(draft.total_pages) : null,
      pages_read: draft.pages_read ? Number(draft.pages_read) : null,
      mood: draft.mood || null,
    };

    if (isEditing) onUpdate(normalized);
    else onCreate(normalized);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="max-h-[88vh] w-[min(96vw,860px)] overflow-y-auto rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.92)] p-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-2xl text-[#F8F4FF]">{isEditing ? 'Edit Entry' : 'Add Entry'}</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF]">✕</button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-[#B9B4D9]">Title *</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]"
            />
            {errors.title && <p className="text-xs text-[#ff9ab8]">{errors.title}</p>}
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[#B9B4D9]">Type</span>
            <select
              value={draft.type}
              onChange={(e) => {
                const nextType = e.target.value as CultureType;
                setDraft((p) => ({
                  ...p,
                  type: nextType,
                  status: nextType === 'book' ? p.status || 'Reading' : p.status,
                }));
              }}
              className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]"
            >
              <option value="movie">movie</option>
              <option value="series">series</option>
              <option value="book">book</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[#B9B4D9]">Wishlist</span>
            <button
              type="button"
              onClick={() => setDraft((p) => ({ ...p, in_wishlist: !p.in_wishlist }))}
              className={`h-10 w-full rounded-lg border px-3 text-sm ${draft.in_wishlist ? 'border-[#C084FC77] bg-[#C084FC2A] text-[#F8F4FF]' : 'border-white/10 bg-black/20 text-[#B9B4D9]'}`}
            >
              {draft.in_wishlist ? 'In Wishlist' : 'In Entries'}
            </button>
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-[#B9B4D9]">Image URL *</span>
            <input
              value={draft.image_url}
              onChange={(e) => setDraft((p) => ({ ...p, image_url: e.target.value }))}
              placeholder="https://..."
              className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]"
            />
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-[#B9B4D9]">Or upload image file *</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-[#F8F4FF]"
            />
            {errors.image_url && <p className="text-xs text-[#ff9ab8]">{errors.image_url}</p>}
          </label>

          {!!previewUrl && (
            <div className="md:col-span-2">
              <img src={previewUrl} alt="preview" className="h-36 w-24 rounded-lg border border-white/10 object-cover" />
            </div>
          )}

          <label className="space-y-1">
            <span className="text-xs text-[#B9B4D9]">Language *</span>
            <select
              value={draft.language}
              onChange={(e) => setDraft((p) => ({ ...p, language: e.target.value }))}
              className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]"
            >
              <option value="">Select</option>
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>{language}</option>
              ))}
            </select>
            {errors.language && <p className="text-xs text-[#ff9ab8]">{errors.language}</p>}
          </label>

          <label className="space-y-1">
            <span className="text-xs text-[#B9B4D9]">Date completed</span>
            <input
              type="date"
              value={draft.date_completed}
              onChange={(e) => setDraft((p) => ({ ...p, date_completed: e.target.value }))}
              className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]"
            />
            {errors.date_completed && <p className="text-xs text-[#ff9ab8]">{errors.date_completed}</p>}
          </label>

          {(draft.type !== 'book' || draft.category_kind === 'fiction') && (
            <div className="space-y-1 md:col-span-2">
              <span className="text-xs text-[#B9B4D9]">Genres</span>
              <div className="flex flex-wrap gap-1.5">
                {GENRES.map((genre) => {
                  const active = draft.genres.includes(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          genres: active ? p.genres.filter((g) => g !== genre) : [...p.genres, genre],
                        }))
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${active ? 'border-[#FF3EA577] bg-[#FF3EA530] text-[#F8F4FF]' : 'border-white/10 bg-black/20 text-[#B9B4D9]'}`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
              {errors.genres && <p className="text-xs text-[#ff9ab8]">{errors.genres}</p>}
            </div>
          )}

          {(draft.type === 'movie' || draft.type === 'series') && (
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-[#B9B4D9]">Rating (0-10)</span>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={draft.rating || '0'}
                onChange={(e) => setDraft((p) => ({ ...p, rating: e.target.value }))}
                className="w-full"
              />
              <p className="text-xs text-[#B9B4D9]">{draft.rating || '0.0'}</p>
            </label>
          )}

          {draft.type === 'series' && (
            <>
              <label className="space-y-1">
                <span className="text-xs text-[#B9B4D9]">Status</span>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]"
                >
                  <option value="">Select</option>
                  {SERIES_STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-[#B9B4D9]">Seasons watched</span>
                <input type="number" min="0" value={draft.seasons_watched} onChange={(e) => setDraft((p) => ({ ...p, seasons_watched: e.target.value }))} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-[#B9B4D9]">Episodes watched</span>
                <input type="number" min="0" value={draft.episodes_watched} onChange={(e) => setDraft((p) => ({ ...p, episodes_watched: e.target.value }))} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]" />
              </label>
            </>
          )}

          {draft.type === 'book' && (
            <>
              <div className="space-y-1 md:col-span-2">
                <span className="text-xs text-[#B9B4D9]">Book Type</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, category_kind: 'fiction' }))}
                    className={`rounded-full border px-3 py-1 text-xs ${draft.category_kind === 'fiction' ? 'border-[#FF3EA577] bg-[#FF3EA530] text-[#F8F4FF]' : 'border-white/10 bg-black/20 text-[#B9B4D9]'}`}
                  >
                    Fiction
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, category_kind: 'deen', genres: [] }))}
                    className={`rounded-full border px-3 py-1 text-xs ${draft.category_kind === 'deen' ? 'border-[#C084FC77] bg-[#C084FC2A] text-[#F8F4FF]' : 'border-white/10 bg-black/20 text-[#B9B4D9]'}`}
                  >
                    Deen
                  </button>
                </div>
              </div>

              <label className="space-y-1">
                <span className="text-xs text-[#B9B4D9]">Status *</span>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]"
                >
                  <option value="">Select</option>
                  {BOOK_STATUS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors.status && <p className="text-xs text-[#ff9ab8]">{errors.status}</p>}
              </label>

              <label className="space-y-1">
                <span className="text-xs text-[#B9B4D9]">Mood *</span>
                <select
                  value={draft.mood}
                  onChange={(e) => setDraft((p) => ({ ...p, mood: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]"
                >
                  <option value="">Select</option>
                  {BOOK_MOODS.map((mood) => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </select>
                {errors.mood && <p className="text-xs text-[#ff9ab8]">{errors.mood}</p>}
              </label>

              <label className="space-y-1">
                <span className="text-xs text-[#B9B4D9]">Total pages *</span>
                <input type="number" min="1" value={draft.total_pages} onChange={(e) => setDraft((p) => ({ ...p, total_pages: e.target.value }))} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]" />
                {errors.total_pages && <p className="text-xs text-[#ff9ab8]">{errors.total_pages}</p>}
              </label>

              <label className="space-y-1">
                <span className="text-xs text-[#B9B4D9]">Pages read *</span>
                <input type="number" min="0" value={draft.pages_read} onChange={(e) => setDraft((p) => ({ ...p, pages_read: e.target.value }))} className="h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#F8F4FF]" />
                {errors.pages_read && <p className="text-xs text-[#ff9ab8]">{errors.pages_read}</p>}
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs text-[#B9B4D9]">Rating (enabled only when Completed)</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={draft.rating || '0'}
                  disabled={draft.status !== 'Completed'}
                  onChange={(e) => setDraft((p) => ({ ...p, rating: e.target.value }))}
                  className="w-full disabled:opacity-40"
                />
                {errors.rating && <p className="text-xs text-[#ff9ab8]">{errors.rating}</p>}
              </label>
            </>
          )}

          <label className="space-y-1 md:col-span-2">
            <span className="text-xs text-[#B9B4D9]">Review (optional)</span>
            <textarea
              value={draft.review_text}
              onChange={(e) => setDraft((p) => ({ ...p, review_text: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-[#F8F4FF]"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-4 py-1.5 text-xs text-[#F8F4FF]">Cancel</button>
          <button
            type="button"
            onClick={() => save(true)}
            className="rounded-full border border-[#C084FC66] bg-[#C084FC2A] px-4 py-1.5 text-xs text-[#F8F4FF]"
          >
            {isEditing ? 'Move to Wishlist' : 'Add to Wishlist'}
          </button>
          <button type="button" onClick={() => save(false)} className="rounded-full border border-[#FF3EA577] bg-[#FF3EA530] px-4 py-1.5 text-xs text-[#F8F4FF]">
            {isEditing ? 'Save to Entries' : 'Create Entry'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
