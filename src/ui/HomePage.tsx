import { LeftPanel } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { BackgroundShell } from '../components/layout/BackgroundShell';
import { FinanceSticker } from '../components/finance/FinanceSticker';
import { DeenSticker } from '../components/deen/DeenSticker';
import { CultureSticker } from '../components/CultureClub/CultureSticker';
import { PortalGrid } from '../components/PortalGrid';

export function HomePage() {
  return (
    <BackgroundShell>
      <div id="home-ui" data-home-ui className="relative h-full w-full">
        <div
          data-home-layout
          className="grid h-full w-full grid-cols-[25%_50%_25%] gap-4 max-[1180px]:h-auto max-[1180px]:grid-cols-1 max-[1180px]:gap-3 max-[820px]:gap-2"
        >
          <aside className="min-h-0 max-[1180px]:order-2">
            <LeftPanel />
          </aside>
          <section
            data-home-center-column
            className="relative z-30 min-h-0 px-4 py-3 md:px-8 md:py-6 max-[1180px]:order-1 max-[1180px]:px-3 max-[1180px]:py-2 max-[820px]:px-2 max-[820px]:py-1"
          >
            <div data-home-center-stack className="flex h-full flex-col items-center justify-center">
              <div className="w-full">
                <PortalGrid />
              </div>
              <div data-home-sticker-row className="pointer-events-auto z-40 mt-[10px] max-[1180px]:mt-4">
                <div className="flex items-end gap-4 max-[520px]:gap-2">
                  <FinanceSticker />
                  <DeenSticker />
                  <CultureSticker />
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden />
          </section>
          <aside className="min-h-0 pr-4 md:pr-6 lg:pr-8 max-[1180px]:order-3 max-[1180px]:pr-0 max-[820px]:pr-1">
            <RightPanel />
          </aside>
        </div>
      </div>
    </BackgroundShell>
  );
}
