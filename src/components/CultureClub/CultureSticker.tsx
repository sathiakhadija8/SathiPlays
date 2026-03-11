'use client';

import { useState } from 'react';
import { CultureClubModal } from './CultureClubModal';

export function CultureSticker() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open Culture Club"
        data-cursor-hover
        onClick={() => setOpen(true)}
        className="group relative bg-transparent p-0 shadow-none transition-all duration-200 hover:scale-[1.03]"
      >
        <img
          src="/Images/culture.png"
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).src = '/SathiPlays/Images/culture.png';
          }}
          alt="Culture sticker"
          className="cafe-sticker-pulse sticker-icon object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.34)] transition-all duration-200 hover:scale-[1.04]"
        />
      </button>

      <CultureClubModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
