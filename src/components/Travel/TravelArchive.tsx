'use client';

import { useEffect, useState } from 'react';

type ArchiveCard = {
  tripId: string;
  title: string;
  dateRange: string;
  coverImage: string;
  memoryCount: number;
  averageRating: number | null;
};

type ArchivePayload = {
  yearlyRecap: Array<{ year: string; totalTrips: number }>;
  favoritePlaces: Array<{ place: string; visits: number }>;
  scrapbookCards: ArchiveCard[];
};

export function TravelArchive() {
  const [data, setData] = useState<ArchivePayload>({
    yearlyRecap: [],
    favoritePlaces: [],
    scrapbookCards: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/travel/archive', { cache: 'no-store' });
        const payload = (await response.json()) as ArchivePayload;
        if (cancelled) return;
        setData({
          yearlyRecap: Array.isArray(payload?.yearlyRecap) ? payload.yearlyRecap : [],
          favoritePlaces: Array.isArray(payload?.favoritePlaces) ? payload.favoritePlaces : [],
          scrapbookCards: Array.isArray(payload?.scrapbookCards) ? payload.scrapbookCards : [],
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[#d4e6ff2f] bg-[linear-gradient(180deg,rgba(187,220,255,0.14),rgba(141,180,230,0.06))] p-3">
      <div className="mb-3">
        <h3 className="font-serif text-2xl text-[#F2F7FF]">Archive</h3>
        <p className="mt-1 text-xs text-[#C9D9EE]">Your scrapbook cards, yearly recap, and favorite places.</p>
      </div>
      {loading ? <p className="text-sm text-[#C9D9EE]">Loading archive...</p> : null}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
          <h4 className="font-serif text-xl text-[#F2F7FF]">Yearly Recap</h4>
          <div className="mt-2 space-y-2">
            {data.yearlyRecap.length === 0 ? <p className="text-xs text-[#ACC4E1]">No completed trips yet.</p> : null}
            {data.yearlyRecap.map((row) => (
              <div key={row.year} className="flex items-center justify-between rounded-lg border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] px-2 py-1.5">
                <span className="text-sm text-[#EAF2FF]">{row.year}</span>
                <span className="text-xs text-[#BFD3EC]">{row.totalTrips} trips</span>
              </div>
            ))}
          </div>
          <h4 className="mt-4 font-serif text-xl text-[#F2F7FF]">Favorite Places</h4>
          <div className="mt-2 space-y-2">
            {data.favoritePlaces.length === 0 ? <p className="text-xs text-[#ACC4E1]">No place history yet.</p> : null}
            {data.favoritePlaces.map((row) => (
              <div key={row.place} className="flex items-center justify-between rounded-lg border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)] px-2 py-1.5">
                <span className="truncate text-sm text-[#EAF2FF]">{row.place}</span>
                <span className="text-xs text-[#BFD3EC]">{row.visits} visits</span>
              </div>
            ))}
          </div>
        </section>
        <section className="min-h-0 rounded-2xl border border-[#d8e8fb44] bg-[rgba(12,23,40,0.46)] p-3">
          <h4 className="font-serif text-xl text-[#F2F7FF]">Scrapbook Cards</h4>
          <div className="mt-2 grid max-h-[54vh] grid-cols-1 gap-2 overflow-auto pr-1">
            {data.scrapbookCards.length === 0 ? <p className="text-xs text-[#ACC4E1]">No scrapbook cards yet.</p> : null}
            {data.scrapbookCards.map((card) => (
              <article key={card.tripId} className="overflow-hidden rounded-xl border border-[#d7e6ff33] bg-[rgba(201,222,255,0.08)]">
                <img src={card.coverImage || '/Images/background.png'} alt={card.title} className="h-32 w-full object-cover" />
                <div className="p-2">
                  <p className="text-sm text-[#EAF2FF]">{card.title}</p>
                  <p className="text-[11px] text-[#BFD3EC]">{card.dateRange}</p>
                  <p className="text-[11px] text-[#BFD3EC]">{card.memoryCount} memories {card.averageRating ? `• ${card.averageRating.toFixed(1)}★` : ''}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
