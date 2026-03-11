'use client';

import { useCallback, useEffect, useState } from 'react';
import { DeenModal } from './DeenModal';

type DashboardPayload = {
  salah_done?: Array<{ key: string; done: boolean }>;
};

type PrayerTimesPayload = {
  date?: string;
  timezone?: string;
  timings?: { fajr?: string };
};

function currentPartsInTimezone(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

function parseHm(value: string): { hour: number; minute: number } | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function DeenSticker() {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [fajrAlertActive, setFajrAlertActive] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => {
        // Use server defaults when geolocation is unavailable/denied.
      },
      { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 10000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const refreshFajrAlert = useCallback(async () => {
    try {
      const prayerUrl = coords
        ? `/api/deen/prayer-times?latitude=${coords.latitude}&longitude=${coords.longitude}`
        : '/api/deen/prayer-times';

      const [dashboardResponse, prayerResponse] = await Promise.all([
        fetch('/api/deen/dashboard', { cache: 'no-store' }),
        fetch(prayerUrl, { cache: 'no-store' }),
      ]);

      if (!dashboardResponse.ok || !prayerResponse.ok) {
        setFajrAlertActive(false);
        return;
      }

      const dashboard = (await dashboardResponse.json()) as DashboardPayload;
      const prayer = (await prayerResponse.json()) as PrayerTimesPayload;
      const fajrDone = Boolean(dashboard.salah_done?.find((item) => item.key === 'fajr')?.done);
      const fajr = prayer.timings?.fajr ? parseHm(prayer.timings.fajr) : null;
      const prayerDate = prayer.date ?? '';
      const timeZone = prayer.timezone ?? 'Europe/London';
      const now = currentPartsInTimezone(timeZone);

      if (!fajr || !prayerDate) {
        setFajrAlertActive(false);
        return;
      }

      const nowMinutes = now.hour * 60 + now.minute;
      const fajrMinutes = fajr.hour * 60 + fajr.minute;
      const fajrDue = now.date > prayerDate || (now.date === prayerDate && nowMinutes >= fajrMinutes);

      setFajrAlertActive(fajrDue && !fajrDone);
    } catch {
      setFajrAlertActive(false);
    }
  }, [coords]);

  useEffect(() => {
    void refreshFajrAlert();
    const interval = window.setInterval(() => {
      void refreshFajrAlert();
    }, 60_000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshFajrAlert();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshFajrAlert]);

  useEffect(() => {
    if (!open) void refreshFajrAlert();
  }, [open, refreshFajrAlert]);

  return (
    <>
      <button
        type="button"
        aria-label="Open Deen"
        data-cursor-hover
        onClick={() => setOpen(true)}
        className={`group relative bg-transparent p-0 shadow-none transition-all duration-200 hover:scale-[1.03] ${
          fajrAlertActive ? 'deen-fajr-alert-loop' : ''
        }`}
      >
        <img
          src="/Images/deen.png?v=20260301c"
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).src = '/SathiPlays/Images/deen.png';
          }}
          alt="Deen sticker"
          className={`cafe-sticker-pulse sticker-icon -rotate-2 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.32)] transition-all duration-200 hover:scale-[1.04] ${
            fajrAlertActive ? 'deen-fajr-alert-image' : ''
          }`}
        />
      </button>

      <DeenModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
