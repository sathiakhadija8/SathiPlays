'use client';

import { usePathname } from 'next/navigation';
import { HeaderControlsLeft } from './HeaderControlsLeft';
import { HeaderControlsRight } from './HeaderControlsRight';

const WORLD_TITLES: Record<string, string> = {
  '/career': 'Career World',
  '/glow': 'Glow Mode',
  '/home': 'Home World',
  '/food': 'Food World',
  '/vinted': 'Vinted World',
  '/content': 'Content World',
  '/home-world': 'Home World',
};

export function Header() {
  const pathname = usePathname();
  const worldTitle = WORLD_TITLES[pathname ?? ''] ?? null;
  const centerTitle = pathname === '/' ? 'SathiPlays' : worldTitle ?? 'SathiPlays';

  return (
    <header data-global-header className="pointer-events-none fixed left-1/2 top-3 z-[110] w-[min(98vw,1560px)] -translate-x-1/2 px-2 max-[760px]:top-2">
      <div className="pointer-events-auto relative flex items-center justify-between gap-3 rounded-2xl border border-[#C084FC4D] bg-[rgba(18,16,40,0.48)] px-4 py-2.5 shadow-[0_0_20px_rgba(192,132,252,0.2)] backdrop-blur-[20px] max-[760px]:gap-2 max-[760px]:px-2.5 max-[760px]:py-1.5">
        <HeaderControlsLeft />

        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="font-serif text-xl text-[#F8F4FF] drop-shadow-[0_0_10px_rgba(255,62,165,0.24)] max-[900px]:text-lg max-[760px]:hidden">
            {centerTitle}
          </span>
        </div>

        <HeaderControlsRight />
      </div>
    </header>
  );
}
