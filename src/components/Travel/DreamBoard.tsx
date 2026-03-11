'use client';

import { useMemo, useState } from 'react';
import { AddDreamModal } from './AddDreamModal';
import { DreamDetail } from './DreamDetail';
import { DreamGrid, type DreamItem } from './DreamGrid';

export function DreamBoard({
  dreams,
  onCreateDream,
  onUpdateDream,
  onMoveToTrips,
}: {
  dreams: DreamItem[];
  onCreateDream: (payload: Omit<DreamItem, 'id'>) => Promise<string>;
  onUpdateDream: (dream: DreamItem) => Promise<void>;
  onMoveToTrips: (dream: DreamItem) => Promise<void> | void;
}) {
  const [selectedDreamId, setSelectedDreamId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const selectedDream = useMemo(
    () => dreams.find((dream) => dream.id === selectedDreamId) ?? null,
    [dreams, selectedDreamId],
  );

  return (
    <>
      {selectedDream ? (
        <DreamDetail
          dream={selectedDream}
          onBack={() => setSelectedDreamId(null)}
          onSave={(next) => onUpdateDream(next)}
          onMoveToTrips={(dream) => {
            void (async () => {
              await onMoveToTrips(dream);
              setSelectedDreamId(null);
            })();
          }}
        />
      ) : (
        <DreamGrid dreams={dreams} onOpen={(dream) => setSelectedDreamId(dream.id)} onAdd={() => setShowAddModal(true)} />
      )}

      <AddDreamModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreate={async (payload) => {
          const id = await onCreateDream(payload);
          setSelectedDreamId(id);
        }}
      />
    </>
  );
}
