'use client';

import { useMemo, useState } from 'react';
import { AddTripModal } from './AddTripModal';
import { TripDetail } from './TripDetail';
import { TripGrid, type TripItem } from './TripGrid';

export function MyTrips({
  trips,
  onCreateTrip,
  onUpdateTrip,
}: {
  trips: TripItem[];
  onCreateTrip: (payload: Omit<TripItem, 'id'>) => Promise<string>;
  onUpdateTrip: (trip: TripItem) => Promise<void>;
}) {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? null,
    [trips, selectedTripId],
  );

  return (
    <>
      {selectedTrip ? (
        <TripDetail trip={selectedTrip} onBack={() => setSelectedTripId(null)} onSave={(nextTrip) => onUpdateTrip(nextTrip)} />
      ) : (
        <TripGrid trips={trips} onOpen={(trip) => setSelectedTripId(trip.id)} onAdd={() => setShowAddModal(true)} />
      )}

      <AddTripModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={async (payload) => {
          const id = await onCreateTrip(payload);
          setSelectedTripId(id);
        }}
      />
    </>
  );
}
