'use client';

export type DreamTripType = 'UK' | 'Overseas';
export type DreamVibe = 'Solo' | 'Friends' | 'Romantic' | 'Cultural';

export type DreamItem = {
  id: string;
  city: string;
  country: string;
  image: string;
  budgetEstimate: number;
  tripType: DreamTripType;
  why: string;
  vibe: DreamVibe;
  savingsGoal: number;
  savedAmount: number;
};

export function DreamGrid({
  dreams,
  onOpen,
  onAdd,
}: {
  dreams: DreamItem[];
  onOpen: (dream: DreamItem) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-2xl text-[#F2F7FF]">Dream Board</h3>
          <p className="mt-1 text-xs text-[#C9D9EE]">Destinations you want to experience next.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full border border-[#b7d2f2] bg-[rgba(190,218,248,0.16)] px-3 py-1 text-xs text-[#EEF5FF]"
        >
          + Add Destination
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#d4e6ff2f] bg-[linear-gradient(180deg,rgba(187,220,255,0.14),rgba(141,180,230,0.06))] p-3">
        {dreams.length === 0 ? (
          <div className="grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-[#d3e4f94d] text-center text-sm text-[#C9D9EE]">
            <div>
              <p>No dream destinations yet.</p>
              <p className="mt-1 text-xs text-[#AAC2DF]">Add your first dream trip.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dreams.map((dream) => (
              <button
                key={dream.id}
                type="button"
                onClick={() => onOpen(dream)}
                className="overflow-hidden rounded-xl border border-[#d8e8fb44] bg-[rgba(16,26,42,0.42)] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(129,176,235,0.22)]"
              >
                <img src={dream.image || '/Images/background.png'} alt={`${dream.city}, ${dream.country}`} className="h-36 w-full object-cover" />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-[#F2F7FF]">
                    {dream.city}, {dream.country}
                  </p>
                  <p className="mt-1 text-xs text-[#C9D9EE]">£{dream.budgetEstimate.toFixed(2)}</p>
                  <span className="mt-2 inline-flex rounded-full border border-[#d8e8fb55] bg-[rgba(210,234,255,0.12)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#E8F2FF]">
                    {dream.tripType}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
