'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DreamItem, DreamTripType, DreamVibe } from './DreamGrid';

const TRIP_TYPES: DreamTripType[] = ['UK', 'Overseas'];
const VIBES: DreamVibe[] = ['Solo', 'Friends', 'Romantic', 'Cultural'];

export function DreamDetail({
  dream,
  onBack,
  onSave,
  onMoveToTrips,
}: {
  dream: DreamItem;
  onBack: () => void;
  onSave: (dream: DreamItem) => Promise<void> | void;
  onMoveToTrips: (dream: DreamItem) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<DreamItem>(dream);

  useEffect(() => {
    setDraft(dream);
  }, [dream]);

  const savingsRatio = useMemo(() => {
    if (draft.savingsGoal <= 0) return 0;
    return Math.max(0, Math.min(1, draft.savedAmount / draft.savingsGoal));
  }, [draft.savedAmount, draft.savingsGoal]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[#d4e6ff2f] bg-[linear-gradient(180deg,rgba(187,220,255,0.14),rgba(141,180,230,0.06))] p-3">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onBack} className="rounded-full border border-[#d7e6ff33] bg-[rgba(201,222,255,0.12)] px-3 py-1 text-xs text-[#F2F7FF]">
          ← Back
        </button>
        <div className="text-center">
          <h3 className="font-serif text-2xl text-[#F2F7FF]">
            {draft.city}, {draft.country}
          </h3>
          <p className="text-xs text-[#C9D9EE]">Dream destination</p>
        </div>
        <button type="button" onClick={() => void onSave(draft)} className="rounded-full border border-[#b6d2f1] bg-[rgba(196,224,255,0.2)] px-3 py-1 text-xs text-[#EEF6FF]">
          Save
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
            <img src={draft.image || '/Images/background.png'} alt={`${draft.city}, ${draft.country}`} className="h-44 w-full rounded-xl object-cover" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>City</span>
                <input value={draft.city} onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]" />
              </label>
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>Country</span>
                <input value={draft.country} onChange={(e) => setDraft((p) => ({ ...p, country: e.target.value }))} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]" />
              </label>
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>Trip type</span>
                <select value={draft.tripType} onChange={(e) => setDraft((p) => ({ ...p, tripType: e.target.value as DreamTripType }))} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]">
                  {TRIP_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-[#17263b]">
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>Travel vibe</span>
                <select value={draft.vibe} onChange={(e) => setDraft((p) => ({ ...p, vibe: e.target.value as DreamVibe }))} className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]">
                  {VIBES.map((t) => (
                    <option key={t} value={t} className="bg-[#17263b]">
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
            <h4 className="font-serif text-xl text-[#F2F7FF]">Why I want to go</h4>
            <textarea
              value={draft.why}
              onChange={(e) => setDraft((p) => ({ ...p, why: e.target.value }))}
              rows={6}
              className="mt-2 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 py-2 text-sm text-[#F2F7FF]"
              placeholder="Describe the experience you want."
            />
          </section>

          <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3 lg:col-span-2">
            <h4 className="font-serif text-xl text-[#F2F7FF]">Budget & Savings</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>Budget estimate</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.budgetEstimate}
                  onChange={(e) => setDraft((p) => ({ ...p, budgetEstimate: Number(e.target.value || 0) }))}
                  className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]"
                />
              </label>
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>Savings goal</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.savingsGoal}
                  onChange={(e) => setDraft((p) => ({ ...p, savingsGoal: Number(e.target.value || 0) }))}
                  className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]"
                />
              </label>
              <label className="space-y-1 text-xs text-[#C9D9EE]">
                <span>Saved amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.savedAmount}
                  onChange={(e) => setDraft((p) => ({ ...p, savedAmount: Number(e.target.value || 0) }))}
                  className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(212,231,255,0.08)] px-3 text-sm text-[#F2F7FF]"
                />
              </label>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-[#C9D9EE]">
                <span>Savings progress</span>
                <span>{Math.round(savingsRatio * 100)}%</span>
              </div>
              <div className="h-3 rounded-full border border-[#d8e8fb44] bg-[rgba(212,231,255,0.10)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#7fc6ff,#c084fc)] transition-all"
                  style={{ width: `${Math.round(savingsRatio * 100)}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void onMoveToTrips(draft)}
                className="rounded-full border border-[#b6d2f1] bg-[linear-gradient(90deg,rgba(127,198,255,0.24),rgba(192,132,252,0.26))] px-4 py-1.5 text-sm text-[#EEF6FF]"
              >
                Move to My Trips
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
