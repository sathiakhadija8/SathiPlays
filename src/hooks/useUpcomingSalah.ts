'use client';

import { useCallback, useEffect, useState } from 'react';

type DashboardPayload = {
  next_salah?: string | null;
  salah_completed?: boolean;
  date?: string;
};

type PrayerTimesPayload = {
  timings?: Partial<Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', string>>;
};

export type UpcomingSalah = {
  key: string;
  label: string;
  time: string | null;
  isNextDay?: boolean;
};

const PRAYER_LABELS: Record<string, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
  tahajjud: 'Tahajjud',
};

function getPrayerTime(
  prayerKey: string,
  timings: Partial<Record<'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha', string>> | undefined,
) {
  if (!timings) return null;
  if (prayerKey === 'fajr') return timings.fajr ?? null;
  if (prayerKey === 'dhuhr') return timings.dhuhr ?? null;
  if (prayerKey === 'asr') return timings.asr ?? null;
  if (prayerKey === 'maghrib') return timings.maghrib ?? null;
  if (prayerKey === 'isha') return timings.isha ?? null;
  return null;
}

function nextYmd(value: string) {
  const parts = value.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const [year, month, day] = parts;
  const base = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(base.getTime())) return null;
  base.setUTCDate(base.getUTCDate() + 1);
  const nextYear = base.getUTCFullYear();
  const nextMonth = String(base.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(base.getUTCDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function useUpcomingSalah(enabled = true) {
  const [upcoming, setUpcoming] = useState<UpcomingSalah | null>(null);
  const [salahCompleted, setSalahCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setUpcoming(null);
      setSalahCompleted(false);
      return;
    }

    setLoading(true);
    try {
      const [dashboardResponse, prayerTimesResponse] = await Promise.all([
        fetch('/api/deen/dashboard', { cache: 'no-store' }),
        fetch('/api/deen/prayer-times', { cache: 'no-store' }),
      ]);

      if (!dashboardResponse.ok || !prayerTimesResponse.ok) {
        setUpcoming(null);
        setSalahCompleted(false);
        return;
      }

      const dashboard = (await dashboardResponse.json()) as DashboardPayload;
      const prayerTimes = (await prayerTimesResponse.json()) as PrayerTimesPayload;
      const nextSalah = (dashboard.next_salah ?? '').trim();
      if (!nextSalah) {
        if (dashboard.salah_completed) {
          const tomorrow = dashboard.date ? nextYmd(dashboard.date) : null;
          if (tomorrow) {
            const tomorrowResponse = await fetch(`/api/deen/prayer-times?date=${tomorrow}`, { cache: 'no-store' });
            if (tomorrowResponse.ok) {
              const tomorrowTimings = (await tomorrowResponse.json()) as PrayerTimesPayload;
              setUpcoming({
                key: 'fajr',
                label: 'Tomorrow Fajr',
                time: tomorrowTimings.timings?.fajr ?? null,
                isNextDay: true,
              });
              setSalahCompleted(true);
              return;
            }
          }
        }
        setUpcoming(null);
        setSalahCompleted(Boolean(dashboard.salah_completed));
        return;
      }

      setUpcoming({
        key: nextSalah,
        label: PRAYER_LABELS[nextSalah] ?? nextSalah,
        time: getPrayerTime(nextSalah, prayerTimes.timings),
        isNextDay: false,
      });
      setSalahCompleted(false);
    } catch {
      setUpcoming(null);
      setSalahCompleted(false);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const checkInUpcoming = useCallback(async () => {
    if (!enabled || !upcoming?.key || upcoming.isNextDay) return false;
    setSaving(true);
    try {
      const response = await fetch('/api/deen/salah', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prayer_key: upcoming.key }),
      });
      if (!response.ok) return false;
      await refetch();
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [enabled, upcoming?.key, refetch]);

  useEffect(() => {
    if (!enabled) return;
    void refetch();
    const interval = window.setInterval(() => {
      void refetch();
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [enabled, refetch]);

  return { upcoming, salahCompleted, loading, saving, refetch, checkInUpcoming };
}
