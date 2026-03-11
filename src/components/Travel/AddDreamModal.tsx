'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DreamItem, DreamTripType, DreamVibe } from './DreamGrid';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import { toPersistableImageUrl } from '../../utils/imageUrls';

type NewDreamPayload = Omit<DreamItem, 'id'>;

const TRIP_TYPES: DreamTripType[] = ['UK', 'Overseas'];
const VIBES: DreamVibe[] = ['Solo', 'Friends', 'Romantic', 'Cultural'];

export function AddDreamModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: NewDreamPayload) => Promise<void> | void;
}) {
  usePlatformWindowOpen(open);

  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [tripType, setTripType] = useState<DreamTripType>('Overseas');
  const [budgetEstimate, setBudgetEstimate] = useState('0');
  const [why, setWhy] = useState('');
  const [vibe, setVibe] = useState<DreamVibe>('Solo');
  const [savingsGoal, setSavingsGoal] = useState('0');
  const [savedAmount, setSavedAmount] = useState('0');
  const [image, setImage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const imageObjectUrlRef = useRef<string | null>(null);

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
      setTripType('Overseas');
      setBudgetEstimate('0');
      setWhy('');
      setVibe('Solo');
      setSavingsGoal('0');
      setSavedAmount('0');
      setImage('');
      setErrors({});
      if (imageObjectUrlRef.current) {
        URL.revokeObjectURL(imageObjectUrlRef.current);
        imageObjectUrlRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (imageObjectUrlRef.current) URL.revokeObjectURL(imageObjectUrlRef.current);
    };
  }, []);

  if (!open) return null;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!city.trim()) next.city = 'City is required.';
    if (!country.trim()) next.country = 'Country is required.';
    if (!image) next.image = 'Image is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(10,14,24,0.62)] p-4 backdrop-blur-[3px]" onMouseDown={onClose}>
      <section
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[88vh] w-[min(94vw,740px)] flex-col overflow-hidden rounded-3xl border border-[#d7e6ff33] bg-[linear-gradient(180deg,rgba(20,34,54,0.96),rgba(14,26,44,0.92))] p-4 text-[#F2F7FF]"
      >
        <header className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-2xl">Add Destination</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-[#d7e6ff44] px-3 py-1 text-xs text-[#D8E8FB]">
            ✕
          </button>
        </header>

        <form
          className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!validate()) return;
            const persistableImage = await toPersistableImageUrl(image);
            await onCreate({
              city: city.trim(),
              country: country.trim(),
              image: persistableImage,
              budgetEstimate: Number(budgetEstimate || 0),
              tripType,
              why: why.trim(),
              vibe,
              savingsGoal: Number(savingsGoal || 0),
              savedAmount: Number(savedAmount || 0),
            });
            onClose();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City" error={errors.city}>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]" />
            </Field>
            <Field label="Country" error={errors.country}>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]" />
            </Field>
            <Field label="Type">
              <select value={tripType} onChange={(e) => setTripType(e.target.value as DreamTripType)} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]">
                {TRIP_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-[#17263b]">
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Travel vibe">
              <select value={vibe} onChange={(e) => setVibe(e.target.value as DreamVibe)} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]">
                {VIBES.map((t) => (
                  <option key={t} value={t} className="bg-[#17263b]">
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Budget estimate">
              <input type="number" min="0" step="0.01" value={budgetEstimate} onChange={(e) => setBudgetEstimate(e.target.value)} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]" />
            </Field>
            <Field label="Savings goal">
              <input type="number" min="0" step="0.01" value={savingsGoal} onChange={(e) => setSavingsGoal(e.target.value)} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]" />
            </Field>
            <Field label="Saved amount">
              <input type="number" min="0" step="0.01" value={savedAmount} onChange={(e) => setSavedAmount(e.target.value)} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]" />
            </Field>
            <Field label="Cover image" error={errors.image}>
              <label className="flex h-10 cursor-pointer items-center rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#D3E4FA]">
                Upload image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (imageObjectUrlRef.current) URL.revokeObjectURL(imageObjectUrlRef.current);
                    const url = URL.createObjectURL(file);
                    imageObjectUrlRef.current = url;
                    setImage(url);
                  }}
                />
              </label>
            </Field>
          </div>

          {image ? <img src={image} alt="Destination cover" className="h-36 w-full rounded-xl object-cover" /> : null}

          <Field label="Why I want to go">
            <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={3} className="w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 py-2 text-sm text-[#F2F7FF]" />
          </Field>

          <div className="flex justify-end">
            <button type="submit" className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-4 py-1.5 text-sm text-[#EEF6FF]">
              Save Destination
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs text-[#C9D9EE]">
      <span>{label}</span>
      {children}
      {error ? <p className="text-[11px] text-[#ff9eb3]">{error}</p> : null}
    </label>
  );
}
