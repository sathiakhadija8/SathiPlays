'use client';

import type { ReactNode } from 'react';
import { RainOverlay } from '../components/Atmosphere/RainOverlay';
import { StarsOverlay } from '../components/Atmosphere/StarsOverlay';
import { Header } from '../components/Header/Header';
import { useAtmosphere } from '../state/AtmosphereContext';

export function AppShell({ children }: { children: ReactNode }) {
  const { isRainOn, isStarsOn } = useAtmosphere();

  return (
    <>
      {isStarsOn ? <StarsOverlay /> : null}
      {isRainOn ? <RainOverlay /> : null}
      {isRainOn ? <div className="pointer-events-none fixed inset-0 z-[9] bg-[linear-gradient(180deg,rgba(170,200,235,0.05),rgba(140,170,205,0.03)_35%,rgba(18,16,40,0.05))]" aria-hidden /> : null}
      <Header />
      {children}
    </>
  );
}
