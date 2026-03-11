'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TripItem } from './TripGrid';
import { BudgetEstimator } from './BudgetEstimator';
import { Itinerary } from './Itinerary';
import { PackingList, type PlannerSupplementPackingItem } from './PackingList';
import { createDefaultPackingCards, normalizePackingCards, type PlannerTripData } from './plannerTypes';

export function PlannerView({
  upcomingTrips,
  plannerByTripId,
  onPlannerChange,
  onMovePlannedToMyTrips,
}: {
  upcomingTrips: TripItem[];
  plannerByTripId: Record<string, PlannerTripData>;
  onPlannerChange: (tripId: string, planner: PlannerTripData) => Promise<void> | void;
  onMovePlannedToMyTrips: (tripId: string) => Promise<void> | void;
}) {
  const [selectedTripId, setSelectedTripId] = useState<string>(upcomingTrips[0]?.id ?? '');
  const [supplements, setSupplements] = useState<PlannerSupplementPackingItem[]>([]);
  const [supplementsLoading, setSupplementsLoading] = useState(false);

  const selectedTrip = useMemo(
    () => upcomingTrips.find((trip) => trip.id === selectedTripId) ?? upcomingTrips[0] ?? null,
    [selectedTripId, upcomingTrips],
  );

  if (!selectedTrip) {
    return (
      <div className="h-full rounded-2xl border border-[#d4e6ff2f] bg-[linear-gradient(180deg,rgba(187,220,255,0.14),rgba(141,180,230,0.06))] p-4">
        <h3 className="font-serif text-2xl text-[#F2F7FF]">Planner</h3>
        <p className="mt-3 text-sm text-[#C9D9EE]">No upcoming trips to plan right now.</p>
      </div>
    );
  }

  const planner = plannerByTripId[selectedTrip.id] ?? {
    itinerary: [],
    packingCards: createDefaultPackingCards(),
    budget: { flights: 0, hotel: 0, activities: 0, food: 0, misc: 0 },
  };

  const normalizedPlanner: PlannerTripData = {
    ...planner,
    packingCards: normalizePackingCards((planner as { packingCards?: unknown; packing?: unknown }).packingCards ?? (planner as { packing?: unknown }).packing),
  };

  const setPlanner = (next: PlannerTripData) => {
    void onPlannerChange(selectedTrip.id, next);
  };

  useEffect(() => {
    let cancelled = false;
    const loadSupplements = async () => {
      setSupplementsLoading(true);
      try {
        const response = await fetch(`/api/travel/planner/supplements?tripId=${encodeURIComponent(selectedTrip.id)}`, { cache: 'no-store' });
        const payload = (await response.json()) as { supplements?: PlannerSupplementPackingItem[] };
        if (cancelled) return;
        setSupplements(Array.isArray(payload.supplements) ? payload.supplements : []);
      } catch {
        if (!cancelled) setSupplements([]);
      } finally {
        if (!cancelled) setSupplementsLoading(false);
      }
    };
    void loadSupplements();
    return () => {
      cancelled = true;
    };
  }, [selectedTrip.id, selectedTrip.startDate, selectedTrip.endDate]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[#d4e6ff2f] bg-[linear-gradient(180deg,rgba(187,220,255,0.14),rgba(141,180,230,0.06))] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-serif text-2xl text-[#F2F7FF]">Planner</h3>
        </div>
        <select
          value={selectedTrip.id}
          onChange={(event) => setSelectedTripId(event.target.value)}
          className="h-9 rounded-full border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-3 text-xs text-[#F2F7FF]"
        >
          {upcomingTrips.map((trip) => (
            <option key={trip.id} value={trip.id} className="bg-[#17263b]">
              {trip.city}, {trip.country}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void onMovePlannedToMyTrips(selectedTrip.id)}
          className="rounded-full border border-[#b7d2f2] bg-[rgba(190,218,248,0.16)] px-3 py-1 text-xs text-[#EEF5FF]"
        >
          Done Planning → Move to My Trips
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid gap-3 lg:grid-cols-2">
          <Itinerary days={normalizedPlanner.itinerary} onChange={(next) => setPlanner({ ...normalizedPlanner, itinerary: next })} />
          <PackingList
            cards={normalizedPlanner.packingCards}
            supplements={supplements}
            supplementsLoading={supplementsLoading}
            onChange={(next) => setPlanner({ ...normalizedPlanner, packingCards: next })}
          />
          <div className="lg:col-span-2">
            <BudgetEstimator budget={normalizedPlanner.budget} onChange={(next) => setPlanner({ ...normalizedPlanner, budget: next })} />
          </div>
        </div>
      </div>
    </div>
  );
}
