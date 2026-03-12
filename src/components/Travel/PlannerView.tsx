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
  type PlannerTemplate = {
    id: string;
    name: string;
    tripMode: 'same_day' | 'weekend' | 'holiday' | 'custom';
    planner: PlannerTripData;
  };

  const [selectedTripId, setSelectedTripId] = useState<string>(upcomingTrips[0]?.id ?? '');
  const [supplements, setSupplements] = useState<PlannerSupplementPackingItem[]>([]);
  const [supplementsLoading, setSupplementsLoading] = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [templates, setTemplates] = useState<PlannerTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');

  const selectedTrip = useMemo(
    () => upcomingTrips.find((trip) => trip.id === selectedTripId) ?? upcomingTrips[0] ?? null,
    [selectedTripId, upcomingTrips],
  );
  const selectedTripIdForApis = selectedTrip?.id ?? '';
  const selectedTripStartDate = selectedTrip?.startDate ?? '';
  const selectedTripEndDate = selectedTrip?.endDate ?? '';
  const selectedTripKey = selectedTrip?.id ?? '';

  const planner = plannerByTripId[selectedTripKey] ?? {
    itinerary: [],
    packingCards: createDefaultPackingCards(),
    budget: { flights: 0, hotel: 0, activities: 0, food: 0, misc: 0 },
  };

  const normalizedPlanner: PlannerTripData = {
    ...planner,
    packingCards: normalizePackingCards((planner as { packingCards?: unknown; packing?: unknown }).packingCards ?? (planner as { packing?: unknown }).packing),
  };

  const setPlanner = (next: PlannerTripData) => {
    if (!selectedTrip) return;
    void onPlannerChange(selectedTrip.id, next);
  };

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await fetch('/api/travel/templates', { cache: 'no-store' });
      const payload = (await response.json()) as PlannerTemplate[];
      setTemplates(Array.isArray(payload) ? payload : []);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const runAutofill = async () => {
    if (!selectedTripIdForApis) return;
    setAutofillLoading(true);
    try {
      const response = await fetch(`/api/travel/planner/auto?tripId=${encodeURIComponent(selectedTripIdForApis)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json()) as { planner?: PlannerTripData };
      if (!response.ok || !payload?.planner) return;
      await onPlannerChange(selectedTripIdForApis, payload.planner);
    } finally {
      setAutofillLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadSupplements = async () => {
      setSupplementsLoading(true);
      try {
        if (!selectedTripIdForApis) {
          setSupplements([]);
          return;
        }
        const response = await fetch(`/api/travel/planner/supplements?tripId=${encodeURIComponent(selectedTripIdForApis)}`, { cache: 'no-store' });
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
  }, [selectedTripIdForApis, selectedTripStartDate, selectedTripEndDate]);

  useEffect(() => {
    void loadTemplates();
  }, []);

  const deriveTripMode = () => {
    const days = Number(selectedTrip?.duration_days ?? 0);
    if (days <= 1) return 'same_day';
    if (days <= 4) return 'weekend';
    if (days >= 5) return 'holiday';
    return 'custom';
  };

  const saveAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) return;
    await fetch('/api/travel/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        tripMode: deriveTripMode(),
        planner: normalizedPlanner,
      }),
    });
    setTemplateName('');
    await loadTemplates();
  };

  const applyTemplate = async () => {
    if (!selectedTemplateId || !selectedTrip) return;
    const template = templates.find((entry) => entry.id === selectedTemplateId);
    if (!template) return;
    await onPlannerChange(selectedTrip.id, template.planner);
  };

  if (!selectedTrip) {
    return (
      <div className="h-full rounded-2xl border border-[#d4e6ff2f] bg-[linear-gradient(180deg,rgba(187,220,255,0.14),rgba(141,180,230,0.06))] p-4">
        <h3 className="font-serif text-2xl text-[#F2F7FF]">Planner</h3>
        <p className="mt-3 text-sm text-[#C9D9EE]">No upcoming trips to plan right now.</p>
      </div>
    );
  }

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
          onClick={() => void runAutofill()}
          disabled={autofillLoading}
          className="rounded-full border border-[#cce0fa] bg-[rgba(206,228,255,0.18)] px-3 py-1 text-xs text-[#EEF5FF] disabled:opacity-60"
        >
          {autofillLoading ? 'Auto-building...' : 'Auto Build Plan'}
        </button>
        <div className="flex items-center gap-1.5">
          <select
            value={selectedTemplateId}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            className="h-8 rounded-full border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-2 text-[11px] text-[#F2F7FF]"
          >
            <option value="">{templatesLoading ? 'Loading templates...' : 'Choose template'}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id} className="bg-[#17263b]">
                {template.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void applyTemplate()}
            disabled={!selectedTemplateId}
            className="rounded-full border border-[#b7d2f2] bg-[rgba(190,218,248,0.16)] px-2.5 py-1 text-[11px] text-[#EEF5FF] disabled:opacity-60"
          >
            Apply
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Save as template"
            className="h-8 rounded-full border border-[#d7e6ff40] bg-[rgba(16,28,46,0.48)] px-3 text-[11px] text-[#F2F7FF]"
          />
          <button
            type="button"
            onClick={() => void saveAsTemplate()}
            disabled={!templateName.trim()}
            className="rounded-full border border-[#b7d2f2] bg-[rgba(190,218,248,0.16)] px-2.5 py-1 text-[11px] text-[#EEF5FF] disabled:opacity-60"
          >
            Save Template
          </button>
        </div>
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
