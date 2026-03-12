'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTravelStore } from '../../hooks/useTravelStore';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import { DreamBoard } from './DreamBoard';
import { MyTrips } from './MyTrips';
import { Planner } from './Planner';
import { TravelArchive } from './TravelArchive';
import { TravelTabs, type TravelTabKey } from './TravelTabs';

export function TravelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  usePlatformWindowOpen(open);

  const [activeTravelTab, setActiveTravelTab] = useState<TravelTabKey>('trips');
  const {
    trips,
    dreamDestinations,
    plannerData,
    addTrip,
    updateTrip,
    addDream,
    updateDream,
    moveDreamToTrip,
    updatePlanner,
  } = useTravelStore();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(12,10,32,0.48)] p-4 backdrop-blur-[3px]"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Travel Modal"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-[min(84vh,740px)] w-[min(94vw,980px)] flex-col overflow-hidden rounded-2xl border border-[#cae2ff33] bg-[linear-gradient(180deg,rgba(20,34,54,0.90),rgba(14,26,44,0.86))] text-[#F2F7FF] shadow-[0_0_30px_rgba(141,186,243,0.18)]"
      >
        <header className="flex items-center justify-between border-b border-[#d7e6ff22] px-5 py-4">
          <h2 className="font-serif text-3xl">Travel</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#d7e6ff33] bg-[rgba(201,222,255,0.12)] px-3 py-1 text-xs text-[#F2F7FF] transition-colors hover:bg-[rgba(201,222,255,0.2)]"
          >
            ✕
          </button>
        </header>

        <div className="border-b border-[#d7e6ff22] px-5 py-3">
          <TravelTabs activeTab={activeTravelTab} onChange={setActiveTravelTab} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div key={activeTravelTab} className="h-full animate-[fadeSlideIn_260ms_ease-out]">
            {activeTravelTab === 'trips' ? (
              <MyTrips trips={trips.filter((trip) => trip.status !== 'upcoming')} onCreateTrip={addTrip} onUpdateTrip={updateTrip} />
            ) : activeTravelTab === 'dream' ? (
              <DreamBoard
                dreams={dreamDestinations}
                onCreateDream={addDream}
                onUpdateDream={updateDream}
                onMoveToTrips={(dream) => {
                  void (async () => {
                    await moveDreamToTrip(dream.id);
                    setActiveTravelTab('trips');
                  })();
                }}
              />
            ) : activeTravelTab === 'planner' ? (
              <Planner
                upcomingTrips={trips.filter((trip) => trip.status === 'upcoming')}
                plannerByTripId={plannerData}
                onPlannerChange={updatePlanner}
                onMovePlannedToMyTrips={async (tripId) => {
                  const trip = trips.find((entry) => String(entry.id) === String(tripId));
                  if (!trip) return;
                  await updateTrip({ ...trip, status: 'completed' });
                }}
              />
            ) : (
              <TravelArchive />
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
