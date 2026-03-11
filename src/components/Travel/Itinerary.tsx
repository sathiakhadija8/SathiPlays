'use client';

import type { PlannerItineraryDay } from './plannerTypes';

export function Itinerary({
  days,
  onChange,
}: {
  days: PlannerItineraryDay[];
  onChange: (next: PlannerItineraryDay[]) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-serif text-xl text-[#F2F7FF]">Itinerary</h4>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...days,
              { id: `day-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, title: `Day ${days.length + 1}`, notes: '' },
            ])
          }
          className="rounded-full border border-[#b7d2f2] bg-[rgba(190,218,248,0.16)] px-3 py-1 text-xs text-[#EEF5FF]"
        >
          + Add Day
        </button>
      </div>

      <div className="space-y-2">
        {days.length === 0 ? <p className="text-xs text-[#ADC5E1]">No itinerary days yet.</p> : null}

        {days.map((day, index) => (
          <div key={day.id} className="rounded-xl border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] p-2">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={day.title}
                onChange={(event) =>
                  onChange(
                    days.map((entry) => (entry.id === day.id ? { ...entry, title: event.target.value } : entry)),
                  )
                }
                className="h-8 flex-1 rounded-lg border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-2 text-xs text-[#F2F7FF]"
                placeholder={`Day ${index + 1}`}
              />
              <button
                type="button"
                onClick={() => onChange(days.filter((entry) => entry.id !== day.id))}
                className="rounded-full border border-[#d7e6ff33] px-2 py-0.5 text-[11px] text-[#D8E8FB]"
              >
                Remove
              </button>
            </div>
            <textarea
              value={day.notes}
              onChange={(event) =>
                onChange(
                  days.map((entry) => (entry.id === day.id ? { ...entry, notes: event.target.value } : entry)),
                )
              }
              rows={3}
              className="w-full rounded-lg border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-2 py-1.5 text-xs text-[#F2F7FF]"
              placeholder="Notes for this day"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
