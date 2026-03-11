'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';
import { AddEntryButton } from './AddEntryButton';
import { CultureFilters } from './CultureFilters';
import { CultureGrid } from './CultureGrid';
import { CultureTabs, type CultureType } from './CultureTabs';
import type { CultureItem } from './CultureCard';
import { CultureEntryModal } from './CultureEntryModal';
import { useCultureEntries } from '../../hooks/useCultureEntries';

const MOCK_ITEMS: CultureItem[] = [
  {
    id: 1,
    created_at: '2026-02-01T08:00:00.000Z',
    title: 'Crash Landing on You',
    type: 'series',
    image_url: '/SathiPlays/Images/background.png',
    language: 'Korean',
    genres: ['Romance', 'Drama'],
    rating: 9.2,
    review_text: 'Comfort rewatch for soft evenings.',
    date_started: '2026-02-01',
    date_completed: '2026-02-22',
    status: 'Completed',
    seasons_watched: 1,
    episodes_watched: 16,
    in_wishlist: false,
  },
  {
    id: 2,
    created_at: '2026-02-03T08:00:00.000Z',
    title: 'Gone Girl',
    type: 'movie',
    image_url: '/SathiPlays/Images/background.png',
    language: 'English',
    genres: ['Psychological', 'Thriller', 'Crime'],
    rating: 8.8,
    review_text: 'Sharp pacing and layered characters.',
    date_completed: '2026-02-10',
    status: 'Completed',
    in_wishlist: false,
  },
  {
    id: 3,
    created_at: '2026-02-12T08:00:00.000Z',
    title: 'Pride and Prejudice',
    type: 'book',
    image_url: '/SathiPlays/Images/background.png',
    language: 'British',
    genres: ['Romance', 'Historical', 'Drama'],
    review_text: 'Elegant language and emotional restraint.',
    date_started: '2026-02-12',
    status: 'Reading',
    author: 'Jane Austen',
    total_pages: 432,
    pages_read: 210,
    mood: 'Thought-provoking',
    category_kind: 'fiction',
    in_wishlist: false,
  },
  {
    id: 4,
    created_at: '2026-02-20T08:00:00.000Z',
    title: 'The Silent Patient',
    type: 'book',
    image_url: '/SathiPlays/Images/background.png',
    language: 'English',
    genres: ['Psychological', 'Thriller'],
    status: 'Reading',
    author: 'Alex Michaelides',
    total_pages: 352,
    pages_read: 0,
    mood: 'Dark',
    category_kind: 'fiction',
    in_wishlist: true,
  },
  {
    id: 5,
    created_at: '2026-01-29T08:00:00.000Z',
    title: 'Yeh Jawaani Hai Deewani',
    type: 'movie',
    image_url: '/SathiPlays/Images/background.png',
    language: 'Bollywood',
    genres: ['Romance', 'Comedy', 'Drama'],
    rating: 8.5,
    review_text: 'Warm, nostalgic, and easy to revisit.',
    date_completed: '2026-01-29',
    status: 'Completed',
    in_wishlist: false,
  },
  {
    id: 6,
    created_at: '2026-01-18T08:00:00.000Z',
    title: 'Sherlock',
    type: 'series',
    image_url: '/SathiPlays/Images/background.png',
    language: 'British',
    genres: ['Crime', 'Drama'],
    rating: 8.9,
    review_text: 'Dense episodes with strong atmosphere.',
    date_started: '2026-01-18',
    status: 'Watching',
    seasons_watched: 2,
    episodes_watched: 7,
    in_wishlist: false,
  },
  {
    id: 7,
    created_at: '2026-02-05T08:00:00.000Z',
    title: 'Atomic Habits',
    type: 'book',
    image_url: '/SathiPlays/Images/background.png',
    language: 'English',
    genres: [],
    review_text: 'Practical systems mindset.',
    date_started: '2026-02-05',
    date_completed: '2026-02-28',
    status: 'Completed',
    author: 'James Clear',
    total_pages: 320,
    pages_read: 320,
    mood: 'Motivated',
    category_kind: 'deen',
    rating: 9.0,
    in_wishlist: false,
  },
  {
    id: 8,
    created_at: '2026-02-14T08:00:00.000Z',
    title: 'The Queen’s Gambit',
    type: 'series',
    image_url: '/SathiPlays/Images/background.png',
    language: 'English',
    genres: ['Drama'],
    status: 'Watching',
    seasons_watched: 1,
    episodes_watched: 0,
    in_wishlist: true,
  },
  {
    id: 9,
    created_at: '2026-02-17T08:00:00.000Z',
    title: 'In the Mood for Love',
    type: 'movie',
    image_url: '/SathiPlays/Images/background.png',
    language: 'Other',
    genres: ['Romance', 'Drama'],
    status: 'Planned',
    in_wishlist: true,
  },
];

function bySort(a: CultureItem, b: CultureItem, mode: 'recent' | 'rating_desc' | 'rating_asc') {
  const asTime = (value?: string | null) => (value ? new Date(value).getTime() : 0);
  if (mode === 'rating_desc') return (b.rating ?? -1) - (a.rating ?? -1);
  if (mode === 'rating_asc') return (a.rating ?? 11) - (b.rating ?? 11);
  const aCompleted = asTime(a.date_completed);
  const bCompleted = asTime(b.date_completed);
  if (aCompleted !== bCompleted) return bCompleted - aCompleted;
  return asTime(b.created_at) - asTime(a.created_at);
}

export function CultureClubModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [activeType, setActiveType] = useState<CultureType>('movie');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CultureItem | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'rating_desc' | 'rating_asc'>('recent');
  const { entries, isLoading, error, createEntry, updateEntry, deleteEntry } = useCultureEntries(MOCK_ITEMS);

  usePlatformWindowOpen(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const { entryItems, wishlistItems } = useMemo(() => {
    const filtered = entries.filter((item) => {
      if (item.type !== activeType) return false;
      if (selectedLanguages.length > 0 && !selectedLanguages.includes(item.language)) return false;
      if (activeType !== 'book' && selectedGenres.length > 0 && !item.genres.some((genre) => selectedGenres.includes(genre))) return false;
      if (activeType === 'book' && selectedGenres.length > 0 && item.category_kind !== 'deen' && !item.genres.some((genre) => selectedGenres.includes(genre))) return false;
      return true;
    });

    const sorted = filtered.slice().sort((a, b) => bySort(a, b, sortBy));
    return {
      wishlistItems: sorted.filter((item) => item.in_wishlist),
      entryItems: sorted.filter((item) => !item.in_wishlist),
    };
  }, [entries, activeType, selectedLanguages, selectedGenres, sortBy]);

  const readingBooks = useMemo(
    () =>
      entries
        .filter((item) => item.type === 'book' && !item.in_wishlist && item.status !== 'Completed')
        .sort((a, b) => bySort(a, b, 'recent')),
    [entries],
  );

  const wishlistActionLabel = (item: CultureItem) => {
    if (item.type === 'movie') return 'Watched';
    return 'Completed';
  };

  const moveWishlistToEntries = async (item: CultureItem) => {
    const now = new Date().toISOString().slice(0, 10);
    await updateEntry({
      ...item,
      in_wishlist: false,
      status: item.type === 'movie' ? 'Watched' : 'Completed',
      date_completed: item.type === 'movie' ? now : item.date_completed || now,
    });
  };

  const moveEntryToWishlist = async (item: CultureItem) => {
    await updateEntry({
      ...item,
      in_wishlist: true,
    });
  };

  const pageCheckin = async (item: CultureItem, delta: number) => {
    const total = Math.max(1, Number(item.total_pages ?? 0));
    const nextPages = Math.min(total, Math.max(0, Number(item.pages_read ?? 0) + delta));
    const isCompleted = nextPages >= total;
    await updateEntry({
      ...item,
      pages_read: nextPages,
      status: isCompleted ? 'Completed' : item.status || 'Reading',
      date_completed: isCompleted ? item.date_completed || new Date().toISOString().slice(0, 10) : item.date_completed ?? null,
    });
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/45 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[min(88vh,760px)] w-[min(96vw,1080px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.86)] shadow-[0_0_34px_rgba(255,62,165,0.20)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="font-serif text-2xl text-[#F8F4FF]">Culture Club</h2>
            <p className="text-xs text-[#B9B4D9]">Track movies, series and books.</p>
          </div>
          <div className="flex items-center gap-2">
            <AddEntryButton
              onClick={() => {
                setEditingEntry(null);
                setEntryModalOpen(true);
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-[#F8F4FF] transition-all duration-200 hover:border-white/35"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <CultureTabs activeType={activeType} onChange={setActiveType} />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`grid h-8 w-8 place-items-center rounded-full border text-xs ${showFilters ? 'border-[#FF3EA566] bg-[#FF3EA522] text-[#F8F4FF]' : 'border-white/15 bg-black/20 text-[#B9B4D9]'}`}
              aria-label="Toggle filters"
            >
              😶‍🌫️
            </button>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'recent' | 'rating_desc' | 'rating_asc')}
              className="h-8 rounded-full border border-white/15 bg-black/20 px-3 text-xs text-[#F8F4FF]"
            >
              <option value="recent">Recently Added</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="rating_asc">Lowest Rated</option>
            </select>
          </div>

          {showFilters && (
            <CultureFilters
              selectedLanguages={selectedLanguages}
              selectedGenres={selectedGenres}
              onToggleLanguage={(language) =>
                setSelectedLanguages((prev) => (prev.includes(language) ? prev.filter((item) => item !== language) : [...prev, language]))
              }
              onToggleGenre={(genre) =>
                setSelectedGenres((prev) => (prev.includes(genre) ? prev.filter((item) => item !== genre) : [...prev, genre]))
              }
              onClear={() => {
                setSelectedLanguages([]);
                setSelectedGenres([]);
              }}
            />
          )}

          {activeType === 'book' && (
            <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-serif text-lg text-[#F8F4FF]">Progress</h3>
                <p className="text-xs text-[#B9B4D9]">Quick page check-in</p>
              </div>
              <div className="space-y-2">
                {readingBooks.length === 0 && <p className="text-xs text-[#B9B4D9]">No active books right now.</p>}
                {readingBooks.map((book) => {
                  const ratio = Math.max(0, Math.min(1, Number(book.pages_read ?? 0) / Math.max(1, Number(book.total_pages ?? 0))));
                  return (
                    <div key={book.id} className="rounded-xl border border-white/10 bg-black/20 p-2">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-[#F8F4FF]">{book.title}</p>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => void pageCheckin(book, 1)} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-2 py-0.5 text-[11px] text-[#F8F4FF]">+1</button>
                          <button type="button" onClick={() => void pageCheckin(book, 5)} className="rounded-full border border-[#C084FC66] bg-[#C084FC22] px-2 py-0.5 text-[11px] text-[#F8F4FF]">+5</button>
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/35">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#FF3EA5] to-[#C084FC]" style={{ width: `${Math.round(ratio * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-serif text-lg text-[#F8F4FF]">Wishlist</h3>
              <p className="text-xs text-[#B9B4D9]">Move into Entries when done</p>
            </div>
            <CultureGrid
              items={wishlistItems}
              onCardClick={(item) => {
                setEditingEntry(item);
                setEntryModalOpen(true);
              }}
              onDelete={(item) => {
                const confirmed = window.confirm(`Delete \"${item.title}\"?`);
                if (!confirmed) return;
                void deleteEntry(item.id);
              }}
              actionLabel={(item) => wishlistActionLabel(item)}
              onAction={(item) => {
                void moveWishlistToEntries(item);
              }}
            />
          </section>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <CultureGrid
              items={entryItems}
              onCardClick={(item) => {
                setEditingEntry(item);
                setEntryModalOpen(true);
              }}
              onDelete={(item) => {
                const confirmed = window.confirm(`Delete \"${item.title}\"?`);
                if (!confirmed) return;
                void deleteEntry(item.id);
              }}
              actionLabel={() => 'Wishlist'}
              onAction={(item) => {
                void moveEntryToWishlist(item);
              }}
            />
            {isLoading && <p className="mt-2 text-xs text-[#B9B4D9]">Loading entries...</p>}
            {error && <p className="mt-2 text-xs text-[#ff9ab8]">{error}</p>}
          </div>
        </div>
      </div>
      <CultureEntryModal
        open={entryModalOpen}
        activeType={activeType}
        editingEntry={editingEntry}
        onClose={() => setEntryModalOpen(false)}
        onCreate={(entry) => void createEntry({ ...entry, created_at: new Date().toISOString() })}
        onUpdate={(entry) => void updateEntry(entry)}
      />
    </div>,
    document.body,
  );
}
