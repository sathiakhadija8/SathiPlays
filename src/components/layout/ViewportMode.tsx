'use client';

import { useEffect } from 'react';

const COMPACT_CLASS_900 = 'viewport-compact-900';
const COMPACT_CLASS_1300 = 'viewport-compact-1300';

export function ViewportMode() {
  useEffect(() => {
    const syncViewportClasses = () => {
      const isCompact1300 = window.innerWidth <= 1300 && window.innerHeight <= 900;
      const isCompact900 = window.innerWidth <= 900 && window.innerHeight <= 800;

      document.body.classList.toggle(COMPACT_CLASS_1300, isCompact1300);
      document.body.classList.toggle(COMPACT_CLASS_900, isCompact900);
    };

    syncViewportClasses();
    window.addEventListener('resize', syncViewportClasses);

    return () => {
      window.removeEventListener('resize', syncViewportClasses);
      document.body.classList.remove(COMPACT_CLASS_1300);
      document.body.classList.remove(COMPACT_CLASS_900);
    };
  }, []);

  return null;
}
