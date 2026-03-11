'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    __sathiWindowOpenCount?: number;
  }
}

const BODY_CLASS = 'platform-window-open';

export function usePlatformWindowOpen(open: boolean) {
  useEffect(() => {
    if (open) return;
    const count = window.__sathiWindowOpenCount ?? 0;
    if (count <= 0) {
      document.body.classList.remove(BODY_CLASS);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const count = (window.__sathiWindowOpenCount ?? 0) + 1;
    window.__sathiWindowOpenCount = count;
    document.body.classList.add(BODY_CLASS);

    return () => {
      const nextCount = Math.max(0, (window.__sathiWindowOpenCount ?? 1) - 1);
      window.__sathiWindowOpenCount = nextCount;
      if (nextCount === 0) {
        document.body.classList.remove(BODY_CLASS);
      }
    };
  }, [open]);
}
