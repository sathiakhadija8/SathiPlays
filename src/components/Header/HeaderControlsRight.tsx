'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

function getLondonNow() {
  return new Date(
    new Date().toLocaleString('en-GB', {
      timeZone: 'Europe/London',
    }),
  );
}

function formatLondonDateTime(date: Date) {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(date);

  const dayNum = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
  }).format(date);

  const month = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    month: 'short',
  }).format(date);

  return `${time} • ${day} ${dayNum} ${month}`;
}

export function HeaderControlsRight() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(() => getLondonNow());
  const [storageWarning, setStorageWarning] = useState<{
    warning: boolean;
    usedPercent: number;
    thresholdPercent: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    const timer = window.setInterval(() => {
      setNow(getLondonNow());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadStorage = async () => {
      try {
        const response = await fetch('/api/system/storage', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          warning?: boolean;
          used_percent?: number;
          threshold_percent?: number;
        };
        if (cancelled) return;
        setStorageWarning({
          warning: Boolean(payload.warning),
          usedPercent: Number(payload.used_percent ?? 0),
          thresholdPercent: Number(payload.threshold_percent ?? 80),
        });
      } catch {
        if (!cancelled) setStorageWarning(null);
      }
    };

    void loadStorage();
    const timer = window.setInterval(() => {
      void loadStorage();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const label = useMemo(() => {
    if (!mounted) return '--:-- • --- -- ---';
    return formatLondonDateTime(now);
  }, [mounted, now]);

  return (
    <div className="flex items-center justify-end gap-3 max-[760px]:gap-2">
      {storageWarning?.warning ? (
        <span className="daily-warning-pulse rounded-full border border-[#ff9eb3] bg-[rgba(255,62,165,0.2)] px-2.5 py-1 text-[11px] font-semibold text-[#ffd9e8]">
          Storage {storageWarning.usedPercent}% ({'>'}
          {storageWarning.thresholdPercent}%)
        </span>
      ) : null}
      <Link
        href="/"
        aria-label="Home"
        className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-[rgba(18,16,40,0.45)] text-base text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#FF3EA588] hover:shadow-[0_0_16px_rgba(255,62,165,0.34)] max-[760px]:h-8 max-[760px]:w-8"
        data-cursor-hover
      >
        🏠
      </Link>
      <span suppressHydrationWarning className="rounded-full border border-white/10 bg-[rgba(18,16,40,0.42)] px-3 py-1.5 text-xs text-[#B9B4D9] max-[760px]:hidden">
        {label}
      </span>
    </div>
  );
}
