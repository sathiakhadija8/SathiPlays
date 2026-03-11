'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type AtmosphereContextValue = {
  isStarsOn: boolean;
  isRainOn: boolean;
  isAmbientOn: boolean;
  volume: number;
  setIsStarsOn: (value: boolean) => void;
  setIsRainOn: (value: boolean) => void;
  setIsAmbientOn: (value: boolean) => void;
  setVolume: (value: number) => void;
  toggleStars: () => void;
  toggleRain: () => void;
  toggleAmbient: () => void;
};

const STORAGE_KEYS = {
  stars: 'sathiplays_isStarsOn',
  rain: 'sathiplays_isRainOn',
  ambient: 'sathiplays_isAmbientOn',
  volume: 'sathiplays_volume',
} as const;

const AtmosphereContext = createContext<AtmosphereContextValue | null>(null);

export function AtmosphereProvider({ children }: { children: ReactNode }) {
  const [isStarsOn, setIsStarsOn] = useState(false);
  const [isRainOn, setIsRainOn] = useState(false);
  const [isAmbientOn, setIsAmbientOn] = useState(false);
  const [volume, setVolumeState] = useState(0.3);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stars = window.localStorage.getItem(STORAGE_KEYS.stars);
    const rain = window.localStorage.getItem(STORAGE_KEYS.rain);
    const ambient = window.localStorage.getItem(STORAGE_KEYS.ambient);
    const storedVolume = window.localStorage.getItem(STORAGE_KEYS.volume);

    if (stars !== null) setIsStarsOn(stars === 'true');
    if (rain !== null) setIsRainOn(rain === 'true');
    if (ambient !== null) setIsAmbientOn(ambient === 'true');

    if (storedVolume !== null) {
      const nextVolume = Number(storedVolume);
      if (Number.isFinite(nextVolume)) {
        setVolumeState(Math.max(0, Math.min(1, nextVolume)));
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.stars, String(isStarsOn));
  }, [isStarsOn]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.rain, String(isRainOn));
  }, [isRainOn]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.ambient, String(isAmbientOn));
  }, [isAmbientOn]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEYS.volume, String(volume));
  }, [volume]);

  const setVolume = useCallback((value: number) => {
    setVolumeState(Math.max(0, Math.min(1, value)));
  }, []);

  const toggleStars = useCallback(() => setIsStarsOn((prev) => !prev), []);
  const toggleRain = useCallback(() => setIsRainOn((prev) => !prev), []);
  const toggleAmbient = useCallback(() => setIsAmbientOn((prev) => !prev), []);

  const value = useMemo<AtmosphereContextValue>(
    () => ({
      isStarsOn,
      isRainOn,
      isAmbientOn,
      volume,
      setIsStarsOn,
      setIsRainOn,
      setIsAmbientOn,
      setVolume,
      toggleStars,
      toggleRain,
      toggleAmbient,
    }),
    [isAmbientOn, isRainOn, isStarsOn, setVolume, toggleAmbient, toggleRain, toggleStars, volume],
  );

  return <AtmosphereContext.Provider value={value}>{children}</AtmosphereContext.Provider>;
}

export function useAtmosphere() {
  const context = useContext(AtmosphereContext);
  if (!context) {
    throw new Error('useAtmosphere must be used within AtmosphereProvider');
  }
  return context;
}

