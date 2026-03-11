'use client';

import { MagazineCard, type MagazineGridEntry } from './MagazineCard';

export function MagazineGrid({
  entries,
  onOpen,
  onDelete,
}: {
  entries: MagazineGridEntry[];
  onOpen: (entry: MagazineGridEntry) => void;
  onDelete: (id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center rounded-2xl border border-dashed border-[#d8c1a3] text-center text-sm text-[#7a624d]">
        <div>
          <p>No magazine issues yet.</p>
          <p className="mt-1 text-xs text-[#8b715b]">Create a new issue to start your A4 canvas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map((entry) => (
        <MagazineCard key={entry.id} entry={entry} onOpen={onOpen} onDelete={onDelete} />
      ))}
    </div>
  );
}
