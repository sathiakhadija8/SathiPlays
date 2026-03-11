'use client';

import { useMemo, useState } from 'react';
import { PlaceEntryModal, type PlaceEntry, type PlaceTag } from './PlaceEntryModal';

const TAGS: PlaceTag[] = ['Cafe', 'Restaurant', 'Museum', 'Event', 'Park'];

type StorePlace = {
  id: string;
  name: string;
  location: string;
  date: string;
  rating: number;
  note: string;
  images: string[];
  tag: string;
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5 text-[13px]">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= value ? 'text-[#f3b14f]' : 'text-[#d9cbb3]'}>
          ★
        </span>
      ))}
    </div>
  );
}

export function PlacesSection({
  places,
  createPlace,
  updatePlace,
}: {
  places: StorePlace[];
  createPlace: (place: StorePlace) => Promise<unknown>;
  updatePlace: (placeId: string, place: StorePlace) => Promise<void>;
}) {
  const [editingPlace, setEditingPlace] = useState<PlaceEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<PlaceTag | 'All'>('All');

  const filteredPlaces = useMemo(() => {
    const sorted = [...places].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (activeTag === 'All') return sorted;
    return sorted.filter((place) => place.tag === activeTag);
  }, [places, activeTag]);

  const openCreate = () => {
    setEditingPlace(null);
    setModalOpen(true);
  };

  const openEdit = (place: StorePlace) => {
    setEditingPlace({
      id: place.id,
      name: place.name,
      location: place.location,
      dateVisited: place.date,
      images: place.images,
      rating: place.rating,
      note: place.note,
      tag: (TAGS.includes(place.tag as PlaceTag) ? (place.tag as PlaceTag) : 'Cafe'),
      createdAt: Date.now(),
    });
    setModalOpen(true);
  };

  const handleSave = async (place: PlaceEntry) => {
    const payload = {
      id: place.id,
      name: place.name,
      location: place.location,
      date: place.dateVisited,
      rating: place.rating,
      note: place.note,
      images: place.images,
      tag: place.tag,
    };
    const exists = places.some((item) => item.id === place.id);
    if (exists) {
      await updatePlace(place.id, payload);
    } else {
      await createPlace(payload);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3
            className="cafe-heading text-[30px] leading-none text-[#4b3426]"
          >
            Places
          </h3>
          <p className="mt-1 text-xs text-[#7a624d]">A warm archive of places you visited and loved.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full border border-[#c8a377] bg-[#fff1dd] px-4 py-1.5 text-xs text-[#5f452f] shadow-[0_0_12px_rgba(175,132,81,0.22)] transition-all duration-200 hover:border-[#b28758] hover:shadow-[0_0_16px_rgba(175,132,81,0.34)]"
        >
          + Add Place
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(['All', ...TAGS] as const).map((tag) => {
          const active = activeTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-all duration-200 ${
                active
                  ? 'border-[#b28958] bg-[#f8e6cc] text-[#4b3426] shadow-[0_0_10px_rgba(178,137,88,0.26)]'
                  : 'border-[#dcc6a8]/80 bg-[#fff7e9]/65 text-[#765f4a] hover:border-[#c6ab84]'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#dec9ad]/80 bg-[#fffaf2]/70 p-3">
        {filteredPlaces.length === 0 ? (
          <div className="grid h-full min-h-[220px] place-items-center rounded-2xl border border-dashed border-[#d8c1a3] text-center text-sm text-[#7a624d]">
            <div>
              <p>No places in this filter yet.</p>
              <p className="mt-1 text-xs text-[#8b715b]">Add one and attach up to as many photos as you want.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPlaces.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => openEdit(place)}
                className="group relative overflow-hidden rounded-xl border border-[#deccb0] bg-[#fffdf7] text-left shadow-[0_8px_18px_rgba(75,52,38,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(75,52,38,0.2)]"
              >
                <img
                  src={place.images[0] || '/Images/background.png'}
                  alt={place.name}
                  className="h-40 w-full object-cover"
                />

                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-[#4f382a]">{place.name}</p>
                  <div className="mt-1">
                    <Stars value={place.rating} />
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-0 bg-[rgba(40,24,16,0.72)] p-3 text-[11px] text-[#fff2e3] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <p className="font-semibold text-[#ffe6cc]">{place.location}</p>
                  <p className="mt-1">{place.date}</p>
                  <p className="mt-1">Rating: {place.rating}/5</p>
                  <p className="mt-1">Tag: {place.tag}</p>
                  <p className="mt-1 line-clamp-3 text-[#f3ddc4]">{place.note || 'No note yet.'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <PlaceEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialPlace={editingPlace ?? null}
      />
    </div>
  );
}
