'use client';

import { useEffect, useState } from 'react';
import { pauseAmbient, playAmbient, setAmbientVolume } from '../../audio/ambientAudio';
import { useAtmosphere } from '../../state/AtmosphereContext';

type ToggleControl = {
  key: 'stars' | 'rain' | 'ambient';
  icon: string;
  label: string;
};

const CONTROLS: ToggleControl[] = [
  { key: 'stars', icon: '🌌', label: 'Stars' },
  { key: 'rain', icon: '🌧', label: 'Rain' },
  { key: 'ambient', icon: '🎧', label: 'Ambient' },
];

export function HeaderControlsLeft() {
  const { isStarsOn, isRainOn, isAmbientOn, volume, toggleStars, toggleRain, toggleAmbient } = useAtmosphere();
  const [showSoundHint, setShowSoundHint] = useState(false);

  useEffect(() => {
    setAmbientVolume(volume);
  }, [volume]);

  useEffect(() => {
    let cancelled = false;

    if (!isAmbientOn) {
      pauseAmbient();
      setShowSoundHint(false);
      return () => {
        cancelled = true;
      };
    }

    playAmbient()
      .then(() => {
        if (!cancelled) setShowSoundHint(false);
      })
      .catch(() => {
        if (!cancelled) setShowSoundHint(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isAmbientOn]);

  return (
    <div className="flex items-center gap-2">
      {CONTROLS.map((control) => {
        const isActive =
          control.key === 'stars' ? isStarsOn : control.key === 'rain' ? isRainOn : isAmbientOn;

        const onClick =
          control.key === 'stars' ? toggleStars : control.key === 'rain' ? toggleRain : toggleAmbient;

        const button = (
          <button
            key={control.key}
            type="button"
            aria-label={control.label}
            onClick={onClick}
            className={`toggle-pill relative rounded-full border px-2.5 py-1.5 text-[11px] transition-all duration-200 max-[760px]:px-2 max-[760px]:py-1 max-[760px]:text-[10px] ${
              isActive
                ? 'toggle-pill-active border-[#C084FC88] bg-[#C084FC2B] text-[#F8F4FF] shadow-[0_0_14px_rgba(192,132,252,0.32)]'
                : 'border-white/15 bg-[rgba(18,16,40,0.45)] text-[#B9B4D9] hover:-translate-y-[1px] hover:border-[#FF3EA566] hover:text-[#F8F4FF]'
            }`}
            data-cursor-hover
          >
            <span className="mr-1" aria-hidden>
              {control.icon}
            </span>
            <span className="max-[760px]:hidden">{control.label}</span>
            <span
              aria-hidden
              className={`pointer-events-none absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full bg-[#FF86C4] transition-all duration-200 ${
                isActive ? 'w-2/3 opacity-100' : 'w-0 opacity-0'
              }`}
            />
          </button>
        );

        if (control.key !== 'ambient') return button;

        return (
          <div key={control.key} className="relative">
            {button}
            {showSoundHint ? (
              <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-[rgba(18,16,40,0.92)] px-2.5 py-1 text-[10px] text-[#F8F4FF] shadow-[0_0_12px_rgba(255,62,165,0.2)]">
                Tap again to enable sound
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
