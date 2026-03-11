'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MultiImageUpload } from '../shared/MultiImageUpload';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import { toPersistableImageUrls } from '../../utils/imageUrls';

export type MemoryBookType = 'friendship' | 'solo' | 'pinterest';

export type MemoryEntry = {
  id: string;
  title: string;
  date: string;
  mood: string;
  note: string;
  bookType: MemoryBookType;
  images: string[];
  createdAt: number;
};

type EntryFormState = {
  title: string;
  date: string;
  mood: string;
  note: string;
  bookType: MemoryBookType;
  images: string[];
};

const BOOK_OPTIONS: Array<{ value: MemoryBookType; label: string }> = [
  { value: 'friendship', label: 'Friendship Archive' },
  { value: 'solo', label: 'Solo Date' },
  { value: 'pinterest', label: 'Pinterest Diary' },
];

const emptyErrors = {
  title: '',
  date: '',
  mood: '',
  images: '',
};

export function MemoryEntryModal({
  open,
  onClose,
  onSave,
  initialEntry,
  defaultBook,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (entry: MemoryEntry) => Promise<void> | void;
  initialEntry: MemoryEntry | null;
  defaultBook: MemoryBookType;
}) {
  usePlatformWindowOpen(open);

  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState(emptyErrors);
  const [form, setForm] = useState<EntryFormState>({
    title: '',
    date: '',
    mood: '',
    note: '',
    bookType: defaultBook,
    images: [],
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const today = new Date().toISOString().slice(0, 10);
    if (initialEntry) {
      setForm({
        title: initialEntry.title,
        date: initialEntry.date,
        mood: initialEntry.mood,
        note: initialEntry.note,
        bookType: initialEntry.bookType,
        images: initialEntry.images,
      });
    } else {
      setForm({
        title: '',
        date: today,
        mood: '',
        note: '',
        bookType: defaultBook,
        images: [],
      });
    }
    setErrors(emptyErrors);
  }, [open, initialEntry, defaultBook]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const modalTitle = useMemo(() => (initialEntry ? 'Edit Memory' : 'New Memory'), [initialEntry]);

  const validate = () => {
    const nextErrors = {
      title: form.title.trim() ? '' : 'Title is required',
      date: form.date ? '' : 'Date is required',
      mood: form.mood.trim() ? '' : 'Mood is required',
      images: form.images.length > 0 ? '' : 'Add at least one image',
    };

    setErrors(nextErrors);
    return Object.values(nextErrors).every((value) => !value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const persistableImages = await toPersistableImageUrls(form.images);
    const payload: MemoryEntry = {
      id: initialEntry?.id ?? `memory_${Date.now()}`,
      title: form.title.trim(),
      date: form.date,
      mood: form.mood.trim(),
      note: form.note.trim(),
      bookType: form.bookType,
      images: persistableImages,
      createdAt: initialEntry?.createdAt ?? Date.now(),
    };

    await onSave(payload);
    setSaving(false);
    onClose();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-[rgba(16,11,37,0.46)] p-4 backdrop-blur-[3px]"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Memory Entry Modal"
        className="cafe-modal-scope flex max-h-[88vh] w-[min(94vw,760px)] flex-col overflow-hidden rounded-[22px] border border-[#e3d2b6]/80 bg-[linear-gradient(180deg,rgba(255,249,238,0.96),rgba(250,240,225,0.92))] p-4 text-[#4b3426] shadow-[0_12px_30px_rgba(43,29,18,0.2)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3
            className="cafe-heading text-[30px] leading-none"
          >
            {modalTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d8c4a2] bg-[#fff4e4] px-3 py-1 text-xs text-[#725941] hover:border-[#c9ae83]"
          >
            ✕
          </button>
        </div>

        <form className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-[#6a5140]">
              Title
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
                placeholder="Saturday in Mayfair"
              />
              {errors.title ? <span className="mt-1 block text-[11px] text-[#b44b4b]">{errors.title}</span> : null}
            </label>

            <label className="text-xs text-[#6a5140]">
              Date
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
              />
              {errors.date ? <span className="mt-1 block text-[11px] text-[#b44b4b]">{errors.date}</span> : null}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-[#6a5140]">
              Mood
              <input
                value={form.mood}
                onChange={(event) => setForm((current) => ({ ...current, mood: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
                placeholder="Warm, nostalgic"
              />
              {errors.mood ? <span className="mt-1 block text-[11px] text-[#b44b4b]">{errors.mood}</span> : null}
            </label>

            <label className="text-xs text-[#6a5140]">
              Book Type
              <select
                value={form.bookType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, bookType: event.target.value as MemoryBookType }))
                }
                className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
              >
                {BOOK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-[#6a5140]">
            Short Note
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
              placeholder="A soft memory I want to keep..."
            />
          </label>

          <MultiImageUpload
            value={form.images}
            onChange={(next) => {
              setForm((current) => ({ ...current, images: next }));
              if (next.length > 0) setErrors((current) => ({ ...current, images: '' }));
            }}
            label="Photos (multiple upload supported)"
            buttonLabel="+ Add images"
          />
          {errors.images ? <span className="-mt-2 block text-[11px] text-[#b44b4b]">{errors.images}</span> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#d8c4a2] bg-[#fff5e7] px-4 py-2 text-xs text-[#6a5140]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full border border-[#b78959] bg-[#f3dcc0] px-4 py-2 text-xs text-[#4f3728] shadow-[0_0_10px_rgba(183,137,89,0.3)] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Memory'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
