'use client';

import { useEffect, useMemo, useState } from 'react';
import { MultiImageUpload } from '../shared/MultiImageUpload';
import type { TripItem, TripStatus } from './TripGrid';
import { toPersistableImageUrl, toPersistableImageUrls } from '../../utils/imageUrls';

const STATUS_OPTIONS: TripStatus[] = ['dream', 'upcoming', 'completed'];

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

  useEffect(() => {
    setDraft(trip);
  }, [trip]);

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
        </div>
      </div>
    </div>
  );
}
