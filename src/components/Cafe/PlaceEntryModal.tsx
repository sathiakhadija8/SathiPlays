'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MultiImageUpload } from '../shared/MultiImageUpload';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import { toPersistableImageUrls } from '../../utils/imageUrls';

export type PlaceTag = 'Cafe' | 'Restaurant' | 'Museum' | 'Event' | 'Park';

export type PlaceEntry = {
  id: string;
  name: string;
  location: string;
  dateVisited: string;
  images: string[];
  rating: number;
  note: string;
  tag: PlaceTag;
  createdAt: number;
};

type PlaceFormState = {
  name: string;
  location: string;
  dateVisited: string;
  images: string[];
  rating: number;
  note: string;
  tag: PlaceTag;
};

const TAG_OPTIONS: PlaceTag[] = ['Cafe', 'Restaurant', 'Museum', 'Event', 'Park'];

const emptyErrors = {
  name: '',
  location: '',
  dateVisited: '',
  images: '',
  rating: '',
  tag: '',
};

function StarPicker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center gap-1 text-xl">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`transition-colors ${star <= value ? 'text-[#f3b14f]' : 'text-[#d8c9b1] hover:text-[#efc47a]'}`}
          aria-label={`Rate ${star} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function PlaceEntryModal({
  open,
  onClose,
  onSave,
  initialPlace,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (place: PlaceEntry) => Promise<void> | void;
  initialPlace: PlaceEntry | null;
}) {
  usePlatformWindowOpen(open);

  const [mounted, setMounted] = useState(false);
  const [errors, setErrors] = useState(emptyErrors);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PlaceFormState>({
    name: '',
    location: '',
    dateVisited: '',
    images: [],
    rating: 4,
    note: '',
    tag: 'Cafe',
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const today = new Date().toISOString().slice(0, 10);

    if (initialPlace) {
      setForm({
        name: initialPlace.name,
        location: initialPlace.location,
        dateVisited: initialPlace.dateVisited,
        images: initialPlace.images,
        rating: initialPlace.rating,
        note: initialPlace.note,
        tag: initialPlace.tag,
      });
    } else {
      setForm({
        name: '',
        location: '',
        dateVisited: today,
        images: [],
        rating: 4,
        note: '',
        tag: 'Cafe',
      });
    }

    setErrors(emptyErrors);
  }, [open, initialPlace]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const modalTitle = useMemo(() => (initialPlace ? 'Edit Place' : 'Add Place'), [initialPlace]);

  const validate = () => {
    const nextErrors = {
      name: form.name.trim() ? '' : 'Place name is required',
      location: form.location.trim() ? '' : 'Location is required',
      dateVisited: form.dateVisited ? '' : 'Date visited is required',
      images: form.images.length > 0 ? '' : 'Add at least one image',
      rating: form.rating >= 1 && form.rating <= 5 ? '' : 'Rating must be 1-5',
      tag: TAG_OPTIONS.includes(form.tag) ? '' : 'Tag is required',
    };

    setErrors(nextErrors);
    return Object.values(nextErrors).every((value) => !value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const persistableImages = await toPersistableImageUrls(form.images);

    const payload: PlaceEntry = {
      id: initialPlace?.id ?? `place_${Date.now()}`,
      name: form.name.trim(),
      location: form.location.trim(),
      dateVisited: form.dateVisited,
      images: persistableImages,
      rating: form.rating,
      note: form.note.trim(),
      tag: form.tag,
      createdAt: initialPlace?.createdAt ?? Date.now(),
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
        aria-label="Place Entry Modal"
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
              Place Name
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
                placeholder="Luna Rooftop"
              />
              {errors.name ? <span className="mt-1 block text-[11px] text-[#b44b4b]">{errors.name}</span> : null}
            </label>

            <label className="text-xs text-[#6a5140]">
              Location
              <input
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
                placeholder="Shoreditch, London"
              />
              {errors.location ? <span className="mt-1 block text-[11px] text-[#b44b4b]">{errors.location}</span> : null}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs text-[#6a5140]">
              Date Visited
              <input
                type="date"
                value={form.dateVisited}
                onChange={(event) => setForm((current) => ({ ...current, dateVisited: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
              />
              {errors.dateVisited ? (
                <span className="mt-1 block text-[11px] text-[#b44b4b]">{errors.dateVisited}</span>
              ) : null}
            </label>

            <label className="text-xs text-[#6a5140]">
              Tag
              <select
                value={form.tag}
                onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value as PlaceTag }))}
                className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
              >
                {TAG_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.tag ? <span className="mt-1 block text-[11px] text-[#b44b4b]">{errors.tag}</span> : null}
            </label>
          </div>

          <div>
            <p className="text-xs text-[#6a5140]">Rating</p>
            <div className="mt-1">
              <StarPicker value={form.rating} onChange={(next) => setForm((current) => ({ ...current, rating: next }))} />
            </div>
            {errors.rating ? <span className="mt-1 block text-[11px] text-[#b44b4b]">{errors.rating}</span> : null}
          </div>

          <label className="block text-xs text-[#6a5140]">
            Experience Note
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
              placeholder="What did this place feel like?"
            />
          </label>

          <MultiImageUpload
            value={form.images}
            onChange={(next) => {
              setForm((current) => ({ ...current, images: next }));
              if (next.length > 0) setErrors((current) => ({ ...current, images: '' }));
            }}
            label="Photos (multiple upload)"
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
              {saving ? 'Saving...' : 'Save Place'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
