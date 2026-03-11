'use client';

import type { PlannerBudget } from './plannerTypes';

const KEYS: Array<{ key: keyof PlannerBudget; label: string }> = [
  { key: 'flights', label: 'Flights' },
  { key: 'hotel', label: 'Hotel' },
  { key: 'activities', label: 'Activities' },
  { key: 'food', label: 'Food' },
  { key: 'misc', label: 'Misc' },
];

export function BudgetEstimator({
  budget,
  onChange,
}: {
  budget: PlannerBudget;
  onChange: (next: PlannerBudget) => void;
}) {
  const total = KEYS.reduce((sum, entry) => sum + Number(budget[entry.key] || 0), 0);

  return (
    <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
      <h4 className="mb-2 font-serif text-xl text-[#F2F7FF]">Budget Estimator</h4>

      <div className="grid gap-2 sm:grid-cols-2">
        {KEYS.map((entry) => (
          <label key={entry.key} className="space-y-1 text-xs text-[#C9D9EE]">
            <span>{entry.label}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget[entry.key]}
              onChange={(event) =>
                onChange({
                  ...budget,
                  [entry.key]: Number(event.target.value || 0),
                })
              }
              className="h-10 w-full rounded-xl border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-3 text-sm text-[#F2F7FF]"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] px-3 py-2 text-sm text-[#EAF2FF]">
        Total: <span className="font-semibold">£{total.toFixed(2)}</span>
      </div>
    </section>
  );
}
