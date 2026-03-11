'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MultiImageUpload } from '../shared/MultiImageUpload';
import type { TripItem, TripStatus } from './TripGrid';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import { toPersistableImageUrl, toPersistableImageUrls } from '../../utils/imageUrls';

const STATUS_OPTIONS: TripStatus[] = ['dream', 'upcoming', 'completed'];

type NewTripPayload = Omit<TripItem, 'id'>;

export function AddTripModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: NewTripPayload) => Promise<void> | void;
}) {
  usePlatformWindowOpen(open);

  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<TripStatus>('dream');
  const [plannedBudget, setPlannedBudget] = useState('0');
  const [spentBudget, setSpentBudget] = useState('0');
  const [reflection, setReflection] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const coverObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setCity('');
      setCountry('');
      setStartDate('');
      setEndDate('');
      setStatus('dream');
      setPlannedBudget('0');
      setSpentBudget('0');
      setReflection('');
      setGallery([]);
      setCoverImage('');
      setErrors({});
      if (coverObjectUrlRef.current) {
        URL.revokeObjectURL(coverObjectUrlRef.current);
        coverObjectUrlRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (coverObjectUrlRef.current) {
        URL.revokeObjectURL(coverObjectUrlRef.current);
      }
    };
  }, []);

  if (!open) return null;

  const handleCoverUpload = (file: File | null) => {
    if (!file) return;
    if (coverObjectUrlRef.current) URL.revokeObjectURL(coverObjectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    coverObjectUrlRef.current = objectUrl;
    setCoverImage(objectUrl);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!city.trim()) nextErrors.city = 'City is required.';
    if (!country.trim()) nextErrors.country = 'Country is required.';
    if (!startDate) nextErrors.startDate = 'Start date is required.';
    if (!endDate) nextErrors.endDate = 'End date is required.';
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      nextErrors.endDate = 'End date must be after start date.';
    }
    if (!coverImage) nextErrors.coverImage = 'Cover image is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;
    const persistableCoverImage = await toPersistableImageUrl(coverImage);
    const persistableGallery = await toPersistableImageUrls(gallery);

    await onCreate({
      city: city.trim(),
      country: country.trim(),
      startDate,
      endDate,
      status,
      coverImage: persistableCoverImage,
      plannedBudget: Number(plannedBudget || 0),
      spentBudget: Number(spentBudget || 0),
      reflection: reflection.trim(),
      gallery: persistableGallery,
      placesVisited: [],
    });

    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(10,14,24,0.62)] p-4 backdrop-blur-[3px]"
      onMouseDown={onClose}
    >
      <section
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[88vh] w-[min(94vw,860px)] flex-col overflow-hidden rounded-3xl border border-[#d7e6ff33] bg-[linear-gradient(180deg,rgba(20,34,54,0.96),rgba(14,26,44,0.92))] p-4 text-[#F2F7FF] shadow-[0_0_40px_rgba(141,186,243,0.2)]"
      >
        <header className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-2xl">Add Trip</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d7e6ff44] px-3 py-1 text-xs text-[#D8E8FB]"
          >
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City" error={errors.city}>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
              />
            </Field>
            <Field label="Country" error={errors.country}>
              <input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
              />
            </Field>
            <Field label="Start date" error={errors.startDate}>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
              />
            </Field>
            <Field label="End date" error={errors.endDate}>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
              />
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TripStatus)}
                className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#17263b]">
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Planned budget">
              <input
                type="number"
                min="0"
                step="0.01"
                value={plannedBudget}
                onChange={(event) => setPlannedBudget(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
              />
            </Field>
            <Field label="Spent budget">
              <input
                type="number"
                min="0"
                step="0.01"
                value={spentBudget}
                onChange={(event) => setSpentBudget(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF] outline-none"
              />
            </Field>
            <Field label="Cover image" error={errors.coverImage}>
              <label className="flex h-10 cursor-pointer items-center rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#D3E4FA]">
                Upload cover
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleCoverUpload(event.target.files?.[0] ?? null)}
                />
              </label>
            </Field>
          </div>

          {coverImage ? (
            <img src={coverImage} alt="Trip cover preview" className="h-36 w-full rounded-xl object-cover" />
          ) : null}

          <Field label="Reflection">
            <textarea
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 py-2 text-sm text-[#F2F7FF] outline-none"
            />
          </Field>

          <MultiImageUpload
            value={gallery}
            onChange={setGallery}
            label="Gallery images"
            buttonLabel="+ Add gallery images"
            className="border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)]"
            thumbClassName="h-20"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-4 py-1.5 text-sm text-[#EEF6FF]"
            >
              Save Trip
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-xs text-[#C9D9EE]">
      <span>{label}</span>
      {children}
      {error ? <p className="text-[11px] text-[#ff9eb3]">{error}</p> : null}
    </label>
  );
}
