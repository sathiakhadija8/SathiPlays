'use client';

import { useState } from 'react';
import { CafeModal } from './CafeModal';

export function CafeSticker({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open Cafe"
        data-cursor-hover
        onClick={() => setOpen(true)}
        className={className}
      >
        <img
          src="/Images/cafe.png"
          alt="Cafe sticker"
          className="cafe-sticker-pulse h-[108px] w-[108px] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.34)] transition-all duration-200 hover:scale-[1.04] max-[900px]:h-[96px] max-[900px]:w-[96px]"
        />
      </button>
      <CafeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
