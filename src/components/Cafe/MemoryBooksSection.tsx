'use client';

import { useMemo, useState } from 'react';
import { MemoryEntryModal, type MemoryBookType, type MemoryEntry } from './MemoryEntryModal';

const BOOKS: Array<{ key: MemoryBookType; title: string; subtitle: string }> = [
  { key: 'friendship', title: 'Friendship Archive', subtitle: 'Shared laughs & little classics' },
  { key: 'solo', title: 'Solo Date', subtitle: 'Quiet confidence moments' },
  { key: 'pinterest', title: 'Pinterest Diary', subtitle: 'Soft aesthetic inspirations' },
];

type StoreMemory = {
  id: string;
  title: string;
  date: string;
  mood: string;
  note: string;
  images: string[];
};

export function MemoryBooksSection({
  memoryBooks,
  createMemory,
  updateMemory,
}: {
  memoryBooks: Record<MemoryBookType, StoreMemory[]>;
  createMemory: (bookKey: MemoryBookType, memory: StoreMemory) => Promise<unknown>;
  updateMemory: (bookKey: MemoryBookType, memoryId: string, memory: StoreMemory) => Promise<void>;
}) {
  const [selectedBook, setSelectedBook] = useState<MemoryBookType>('friendship');
  const [editingEntry, setEditingEntry] = useState<MemoryEntry | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);

  const filteredEntries = useMemo(() => {
    const source = memoryBooks[selectedBook] ?? [];
    return [...source].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [memoryBooks, selectedBook]);

  const currentBook = useMemo(() => BOOKS.find((book) => book.key === selectedBook) ?? BOOKS[0], [selectedBook]);

  const openNewEntryModal = () => {
    setEditingEntry(null);
    setEntryModalOpen(true);
  };

  const openEditEntryModal = (entry: MemoryEntry) => {
    setEditingEntry(entry);
    setEntryModalOpen(true);
  };

  const handleSaveEntry = async (entry: MemoryEntry) => {
    const payload = {
      id: entry.id,
      title: entry.title,
      date: entry.date,
      mood: entry.mood,
      note: entry.note,
      images: entry.images,
    };
    const targetBook = entry.bookType;
    const exists = (memoryBooks[targetBook] ?? []).some((item) => item.id === entry.id);
    if (exists) {
      await updateMemory(targetBook, entry.id, payload);
    } else {
      await createMemory(targetBook, payload);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3
            className="cafe-heading text-[30px] leading-none text-[#4b3426]"
          >
            Memory Books
          </h3>
          <p className="mt-1 text-xs text-[#7a624d]">A scrapbook archive with multiple photos per memory.</p>
        </div>
        <button
          type="button"
          onClick={openNewEntryModal}
          className="rounded-full border border-[#c8a377] bg-[#fff1dd] px-4 py-1.5 text-xs text-[#5f452f] shadow-[0_0_12px_rgba(175,132,81,0.22)] transition-all duration-200 hover:border-[#b28758] hover:shadow-[0_0_16px_rgba(175,132,81,0.34)]"
        >
          + Add Memory
        </button>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {BOOKS.map((book) => {
          const active = selectedBook === book.key;
          return (
            <button
              key={book.key}
              type="button"
              onClick={() => setSelectedBook(book.key)}
              className={`rounded-2xl border px-3 py-2 text-left transition-all duration-200 ${
                active
                  ? 'border-[#b28958] bg-[#f8e6cc] text-[#4b3426] shadow-[0_0_12px_rgba(178,137,88,0.28)]'
                  : 'border-[#dcc6a8]/80 bg-[#fff7e9]/65 text-[#765f4a] hover:border-[#c6ab84]'
              }`}
            >
              <p className="text-sm font-semibold leading-none">{book.title}</p>
              <p className="mt-1 text-[11px] opacity-80">{book.subtitle}</p>
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-[#7a624d]">
        <span>{currentBook.title}</span>
        <span>{filteredEntries.length} memories</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#dec9ad]/80 bg-[#fffaf2]/75 p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filteredEntries.map((entry, cardIndex) => {
            const rotation = [2, -2, 3, -3][cardIndex % 4];
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => openEditEntryModal({ ...entry, bookType: selectedBook, createdAt: Date.now() })}
                className="group relative rounded-xl border border-[#ddc8a8] bg-[#fffcf6] p-2 text-left shadow-[0_6px_18px_rgba(75,52,38,0.16)] transition-transform duration-200 hover:-translate-y-0.5"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                <div className="relative overflow-hidden rounded-lg border border-[#e2d2b9] bg-[#fff6ea] p-1">
                  <img
                    src={entry.images[0]}
                    alt={entry.title}
                    className="h-28 w-full rounded object-cover sm:h-32"
                  />
                </div>
                <p className="cafe-memory-title mt-2 truncate text-xs font-semibold text-[#4f382a]">{entry.title}</p>

                <div className="pointer-events-none absolute inset-0 rounded-xl bg-[rgba(39,22,15,0.68)] p-2 text-[11px] text-[#fff2e3] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <p className="font-semibold">{entry.date}</p>
                  <p className="mt-1">Mood: {entry.mood}</p>
                  <p className="mt-1 line-clamp-3 text-[10px] text-[#f6ddc4]">{entry.note || 'No note yet.'}</p>
                </div>
              </button>
            );
          })}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="grid h-full min-h-[180px] place-items-center rounded-2xl border border-dashed border-[#d8c1a3] text-center text-sm text-[#7a624d]">
            <div>
              <p>No memories yet in this book.</p>
              <p className="mt-1 text-xs text-[#8b715b]">Add one and attach as many images as you want.</p>
            </div>
          </div>
        ) : null}
      </div>

      <MemoryEntryModal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        onSave={handleSaveEntry}
        initialEntry={editingEntry}
        defaultBook={selectedBook}
      />
    </div>
  );
}
