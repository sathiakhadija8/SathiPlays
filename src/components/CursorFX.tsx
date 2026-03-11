'use client';

import { useEffect, useRef } from 'react';

const INTERACTIVE_SELECTOR = 'a,button,input,textarea,select,[role="button"],[data-cursor-hover]';

export function CursorFX() {
  const glowRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointRef = useRef({ x: 0, y: 0 });
  const hoverRef = useRef(false);
  const downRef = useRef(false);

  useEffect(() => {
    // Recover from stale modal-open state after hot-reload/runtime crashes.
    (window as Window & { __sathiWindowOpenCount?: number }).__sathiWindowOpenCount = 0;
    document.body.classList.remove('platform-window-open');

    const glow = glowRef.current;
    if (!glow) return;

    const paint = () => {
      const scale = downRef.current ? 0.92 : 1;
      const opacity = hoverRef.current ? 0.5 : 0.22;
      glow.style.transform = `translate3d(${pointRef.current.x}px, ${pointRef.current.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      glow.style.opacity = `${opacity}`;
      rafRef.current = null;
    };

    const requestPaint = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(paint);
    };

    const onMouseMove = (event: MouseEvent) => {
      pointRef.current = { x: event.clientX, y: event.clientY };
      const target = event.target as HTMLElement | null;
      hoverRef.current = Boolean(target?.closest(INTERACTIVE_SELECTOR));
      requestPaint();
    };

    const onMouseDown = () => {
      downRef.current = true;
      requestPaint();
    };

    const onMouseUp = () => {
      downRef.current = false;
      requestPaint();
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[120] h-6 w-6 rounded-full bg-[#FF3EA5]/70 blur-[9px] transition-[opacity,transform] duration-200"
      style={{ opacity: 0.2, transform: 'translate3d(-100px,-100px,0)' }}
    />
  );
}
