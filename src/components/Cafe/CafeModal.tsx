'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CafeTabs } from './CafeTabs';
import { MemoryBooksSection } from './MemoryBooksSection';
import { PlacesSection } from './PlacesSection';
import { useCafeStore } from '../../hooks/useCafeStore';
import { MagazineSection } from './Magazine/MagazineSection';

type CafeTab = 'books' | 'magazine' | 'places';

const TAB_CONTENT: Record<CafeTab, { title: string; subtitle: string }> = {
  books: {
    title: 'Memory Books',
    subtitle: 'Collect moments, scraps, and soft stories.',
  },
  magazine: {
    title: 'Magazine',
    subtitle: 'A cozy wall for articles and visual clippings.',
  },
  places: {
    title: 'Places',
    subtitle: 'Pin your favorite corners of the world.',
  },
};

export function CafeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<CafeTab>('books');
  const {
    memoryBooks,
    places,
    magazineEntries,
    createMemory,
    updateMemory,
    createPlace,
    updatePlace,
    createMagazine,
    updateMagazine,
    deleteMagazine,
  } =
    useCafeStore();

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

  useEffect(() => {
    if (!open) {
      document.body.classList.remove('cafe-window-open');
      return;
    }

    document.body.classList.add('cafe-window-open');
    return () => {
      document.body.classList.remove('cafe-window-open');
    };
  }, [open]);

  const content = useMemo(() => TAB_CONTENT[activeTab] ?? TAB_CONTENT.books, [activeTab]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-[rgba(13,10,34,0.42)] p-4 backdrop-blur-[3px]"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Cafe Modal"
        onMouseDown={(event) => event.stopPropagation()}
        className="cafe-modal-scope flex h-[min(84vh,760px)] w-[min(94vw,980px)] flex-col overflow-hidden rounded-[24px] border border-[#7f9bff]/55 bg-cover bg-center bg-no-repeat p-4 text-[#eaf0ff] shadow-[0_14px_34px_rgba(16,30,94,0.36)]"
        style={{ backgroundImage: "url('/Images/LandingPage/cafemodal.png')" }}
      >
        <header className="mb-3 flex items-center justify-between">
          <div>
            <h2
              className="cafe-heading text-[34px] leading-none"
            >
              Cafe Corner
            </h2>
            <p className="mt-1 text-xs text-[#c7d5ff]">A warm nostalgic space for memories and inspiration.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#8da8ff] bg-[#2a3f9c]/55 px-3 py-1 text-xs text-[#ecf2ff] transition-all duration-200 hover:border-[#b8c9ff] hover:bg-[#3452c0]/65"
          >
            ✕
          </button>
        </header>

        <CafeTabs activeTab={activeTab} onTabChange={setActiveTab} />

        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#89a4ff]/45 bg-[rgba(11,24,78,0.55)] p-4">
          <div key={activeTab} className="h-full animate-[fadeSlideIn_280ms_ease-out]">
            {activeTab === 'books' ? (
              <MemoryBooksSection memoryBooks={memoryBooks} createMemory={createMemory} updateMemory={updateMemory} />
            ) : activeTab === 'magazine' ? (
              <MagazineSection
                entries={magazineEntries}
                onCreate={createMagazine}
                onUpdate={updateMagazine}
                onDelete={deleteMagazine}
              />
            ) : activeTab === 'places' ? (
              <PlacesSection places={places} createPlace={createPlace} updatePlace={updatePlace} />
            ) : (
              <div className="h-full rounded-xl border border-[#e2d1b8]/85 bg-[#fffdf8]/80 p-4">
                <h3 className="text-[28px] font-serif">
                  {content.title}
                </h3>
                <p className="mt-2 text-sm text-[#c7d5ff]">{content.subtitle}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
