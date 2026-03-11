'use client';

import { PlannerView } from './PlannerView';
import type { PlannerTripData } from './plannerTypes';
import type { TripItem } from './TripGrid';

export function Planner({
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
  return (
    <PlannerView
      upcomingTrips={upcomingTrips}
      plannerByTripId={plannerByTripId}
      onPlannerChange={onPlannerChange}
      onMovePlannedToMyTrips={onMovePlannedToMyTrips}
    />
  );
}
