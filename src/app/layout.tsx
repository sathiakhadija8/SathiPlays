import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CursorFX } from '../components/CursorFX';
import { ViewportMode } from '../components/layout/ViewportMode';
import { AppShell } from '../layouts/AppShell';
import { AtmosphereProvider } from '../state/AtmosphereContext';

export const metadata: Metadata = {
  title: 'SathiPlays',
  description: 'SathiPlays homepage',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ViewportMode />
        <AtmosphereProvider>
          <AppShell>{children}</AppShell>
        </AtmosphereProvider>
        <CursorFX />
      </body>
    </html>
  );
}
