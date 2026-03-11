'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PortalButton } from './PortalButton';
import { CafeSticker } from './Cafe/CafeSticker';
import { TravelSticker } from './Travel/TravelSticker';

const portals = [
  {
    label: 'Career',
    icon: '◧',
    iconImageSrc: '/Images/career.png',
    href: '/career',
    accentBorder: 'linear-gradient(135deg, #3F5BFF, #3F5BFF)',
    glowColor: '#3F5BFF',
  },
  {
    label: 'Glow',
    icon: '✦',
    iconImageSrc: '/Images/glow.png',
    href: '/glow',
    accentBorder: 'linear-gradient(135deg, #FF3EA5, #FF3EA5)',
    glowColor: '#FF3EA5',
  },
  {
    label: 'Home',
    icon: '⌂',
    iconImageSrc: '/Images/home.png',
    href: '/home',
    accentBorder: 'linear-gradient(135deg, #C084FC, #C084FC)',
    glowColor: '#C084FC',
  },
  {
    label: 'Food',
    icon: '◍',
    iconImageSrc: '/Images/food.png',
    href: '/food',
    accentBorder: 'linear-gradient(135deg, #FF3EA5, #FF3EA5)',
    glowColor: '#FF71BF',
  },
  {
    label: 'Vinted',
    icon: '◌',
    iconImageSrc: '/Images/vinted.png?v=20260302b',
    href: '/vinted',
    accentBorder: 'linear-gradient(135deg, #C084FC, #C084FC)',
    glowColor: '#D29EFF',
  },
  {
    label: 'Content',
    icon: '▦',
    iconImageSrc: '/Images/content.png',
    href: '/content',
    accentBorder: 'linear-gradient(135deg, #3F5BFF, #3F5BFF)',
    glowColor: '#6A80FF',
  },
];

export function PortalGrid() {
  const router = useRouter();

  useEffect(() => {
    for (const portal of portals) {
      router.prefetch(portal.href);
    }
  }, [router]);

  return (
    <div className="flex flex-col justify-center">
      <div>
        <div data-home-title-block className="mb-8 text-center max-[1180px]:mb-5 max-[820px]:mb-4">
          <div data-home-logo-wrap className="-mt-3 mb-2 flex justify-center max-[900px]:-mt-2">
            <div className="relative h-[196px] w-full max-w-[620px] max-[1180px]:h-[180px] max-[520px]:h-[150px]">
              <TravelSticker className="absolute left-1/2 top-1/2 z-[12] -translate-x-[220px] -translate-y-[62%] shrink-0 bg-transparent p-0 shadow-none max-[1180px]:-translate-x-[198px] max-[1180px]:-translate-y-[60%] max-[900px]:-translate-x-[220px] max-[900px]:-translate-y-[58%] max-[520px]:-translate-x-[170px] max-[520px]:-translate-y-[54%]" />
              <div className="absolute left-1/2 top-1/2 z-[2] h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2 max-[900px]:h-[148px] max-[900px]:w-[148px] max-[520px]:h-[122px] max-[520px]:w-[122px]">
                <img
                  src="/Images/logo.png"
                  alt="SathiPlays Logo"
                  data-cursor-hover
                  data-home-logo-bubble
                  className="cafe-sticker-pulse h-full w-full shrink-0 rounded-full border border-white/45 bg-[rgba(255,255,255,0.08)] object-cover p-1 shadow-[0_0_28px_rgba(255,255,255,0.54)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_36px_rgba(255,255,255,0.66)]"
                />
              </div>
              <CafeSticker className="absolute left-1/2 top-1/2 z-[11] -translate-y-[50%] translate-x-[112px] shrink-0 -rotate-2 bg-transparent p-0 shadow-none max-[1180px]:translate-x-[102px] max-[900px]:translate-x-[96px] max-[520px]:translate-x-[66px]" />
            </div>
          </div>
          <h1 className="relative right-[32px] font-serif text-[clamp(1.75rem,3vw,2.6rem)] text-[#F8F4FF] drop-shadow-[0_0_16px_rgba(255,62,165,0.2)] max-[1180px]:right-0">
            SathiPlays
          </h1>
          <p className="relative right-[32px] home-portal-caption font-sans text-sm text-[#B9B4D9] max-[1180px]:right-0">Choose your portal</p>
        </div>
        <div data-home-portal-grid className="mx-auto grid w-full max-w-[640px] grid-cols-3 justify-items-center gap-x-6 gap-y-9 max-[820px]:gap-x-3 max-[820px]:gap-y-4 max-[520px]:grid-cols-2 max-[520px]:max-w-[340px]">
          {portals.map((portal, index) => (
            <PortalButton
              key={portal.label}
              label={portal.label}
              icon={portal.icon}
              iconImageSrc={portal.iconImageSrc}
              href={portal.href}
              accentBorder={portal.accentBorder}
              glowColor={portal.glowColor}
              delayMs={index * 260}
              floatDurationSec={6.6 + index * 0.55}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
