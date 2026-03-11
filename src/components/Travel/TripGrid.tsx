'use client';

export type TripStatus = 'dream' | 'upcoming' | 'completed';

export type TripItem = {
  id: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  duration_days?: number;
  status: TripStatus;
  coverImage: string;
  plannedBudget: number;
  spentBudget: number;
  reflection: string;
  gallery: string[];
  placesVisited: string[];
};

function statusStyle(status: TripStatus) {
  if (status === 'completed') return 'border-[#9ad2b4] bg-[#9ad2b422] text-[#d6ffe8]';
  if (status === 'upcoming') return 'border-[#9ac4ff] bg-[#9ac4ff22] text-[#e4f0ff]';
  return 'border-[#d8b9ff] bg-[#d8b9ff22] text-[#f2e8ff]';
}

export function TripGrid({
  trips,
  onOpen,
  onAdd,
}: {
  trips: TripItem[];
  onOpen: (trip: TripItem) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-2xl text-[#F2F7FF]">My Trips</h3>
          <p className="mt-1 text-xs text-[#C9D9EE]">Your post-planning trip journal for memories, reflection, and photos.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full border border-[#b7d2f2] bg-[rgba(190,218,248,0.16)] px-3 py-1 text-xs text-[#EEF5FF]"
        >
          + Add Trip
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#d4e6ff2f] bg-[linear-gradient(180deg,rgba(187,220,255,0.14),rgba(141,180,230,0.06))] p-3">
        {trips.length === 0 ? (
          <div className="grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-[#d3e4f94d] text-center text-sm text-[#C9D9EE]">
            <div>
              <p>No trips added yet.</p>
              <p className="mt-1 text-xs text-[#AAC2DF]">Start by adding your first destination.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => onOpen(trip)}
                className="overflow-hidden rounded-xl border border-[#d8e8fb44] bg-[rgba(16,26,42,0.42)] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(129,176,235,0.22)]"
              >
                <img
                  src={trip.coverImage || '/Images/background.png'}
                  alt={`${trip.city}, ${trip.country}`}
                  className="h-36 w-full object-cover"
                />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-[#F2F7FF]">
                    {trip.city}, {trip.country}
                  </p>
                  <p className="mt-1 text-xs text-[#C9D9EE]">
                    {trip.startDate} - {trip.endDate}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${statusStyle(
                      trip.status,
                    )}`}
                  >
                    {trip.status}
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
