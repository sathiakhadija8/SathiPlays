'use client';

import { useState } from 'react';
import { TravelModal } from './TravelModal';

export function TravelSticker({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open Travel"
        data-cursor-hover
        onClick={() => setOpen(true)}
        className={className}
      >
        <img
          src="/Images/travel.png?v=20260302b"
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).src = '/SathiPlays/Images/travel.png';
          }}
          alt="Travel sticker"
          className="cafe-sticker-pulse h-[182px] w-[182px] shrink-0 rotate-2 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.34)] transition-all duration-200 hover:scale-[1.04] max-[900px]:h-[150px] max-[900px]:w-[150px] max-[520px]:h-[126px] max-[520px]:w-[126px]"
        />
      </button>
      <TravelModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
