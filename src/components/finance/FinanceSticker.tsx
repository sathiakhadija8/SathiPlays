'use client';

import { useState } from 'react';
import { monthKey } from '../../lib/finance-api';
import { FinanceModal } from './FinanceModal';

export function FinanceSticker() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Open Finance"
        data-cursor-hover
        onClick={() => setOpen(true)}
        className="group relative bg-transparent p-0 shadow-none transition-all duration-200"
      >
        {/* Uses your exact asset name from public/Images/Finance.png */}
        <img
          src="/Images/Finance.png"
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).src = '/SathiPlays/Images/Finance.png';
          }}
          alt="Finance sticker"
          className="cafe-sticker-pulse sticker-icon rotate-2 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)] transition-all duration-200 hover:scale-[1.04]"
        />
      </button>

      {open ? <FinanceModal open={open} month={monthKey()} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
