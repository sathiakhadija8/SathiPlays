'use client';

import { useMemo, useState } from 'react';
import { MagazineGrid } from './MagazineGrid';
import type { MagazineGridEntry } from './MagazineCard';
import { A4Editor } from './A4Editor';

type Props = {
  entries: MagazineGridEntry[];
  onCreate: (entry: MagazineGridEntry) => Promise<unknown>;
  onUpdate: (entryId: string, entry: MagazineGridEntry) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
};

function makeDraftEntry(existingCount: number): MagazineGridEntry {
  return {
    id: `temp-${Date.now()}`,
    label: `Issue ${String(existingCount + 1).padStart(2, '0')}`,
    title: 'Untitled Magazine',
    date: new Date().toISOString().slice(0, 10),
    a4_template_src: '/Images/A4Templates/a4_1.svg',
    elements: [],
    cover_preview_image: '/Images/A4Templates/a4_1.svg',
  };
}

export function MagazineSection({ entries, onCreate, onUpdate, onDelete }: Props) {
  const [openEditor, setOpenEditor] = useState(false);
  const [activeEntry, setActiveEntry] = useState<MagazineGridEntry | null>(null);

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entries],
  );

  const handleOpen = (entry: MagazineGridEntry) => {
    setActiveEntry(entry);
    setOpenEditor(true);
  };

  const handleCreate = () => {
    setActiveEntry(makeDraftEntry(entries.length));
    setOpenEditor(true);
  };

  const handleEditorSave = async (updated: MagazineGridEntry) => {
    if (String(updated.id).startsWith('temp-')) {
      await onCreate(updated);
    } else {
      await onUpdate(String(updated.id), updated);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Delete this magazine entry?');
    if (!confirmed) return;
    await onDelete(id);
    if (activeEntry?.id === id) {
      setOpenEditor(false);
      setActiveEntry(null);
    }
  };

  if (openEditor) {
    return (
      <A4Editor
        entry={activeEntry ?? makeDraftEntry(entries.length)}
        onBack={() => setOpenEditor(false)}
        onSave={handleEditorSave}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="cafe-heading text-[30px] leading-none text-[#4b3426]">Magazine</h3>
          <p className="mt-1 text-xs text-[#7a624d]">A4 issue covers. Click a card to open the canvas.</p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-full border border-[#c8a377] bg-[#fff1dd] px-4 py-1.5 text-xs text-[#5f452f] shadow-[0_0_12px_rgba(175,132,81,0.22)] transition-all duration-200 hover:border-[#b28758] hover:shadow-[0_0_16px_rgba(175,132,81,0.34)]"
        >
          + New
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-[#dec9ad]/80 bg-[#fffaf2]/70 p-3">
        <MagazineGrid entries={sortedEntries} onOpen={handleOpen} onDelete={(id) => void handleDelete(id)} />
      </div>
    </div>
  );
}

