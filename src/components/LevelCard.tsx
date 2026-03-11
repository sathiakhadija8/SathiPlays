'use client';

import { useEffect, useMemo, useState } from 'react';
import { GlassCard } from './GlassCard';

type LevelPayload = {
  total_points: number;
  level: {
    number: number;
    label: string;
    min_points: number;
    max_points: number | null;
  };
  progress_ratio: number;
  points_to_next_level: number;
};

const FALLBACK: LevelPayload = {
  total_points: 0,
  level: { number: 1, label: 'Reset', min_points: 0, max_points: 199 },
  progress_ratio: 0,
  points_to_next_level: 200,
};

export function LevelCard() {
  const [data, setData] = useState<LevelPayload>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch('/api/level', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed level fetch');
        const payload = (await response.json()) as LevelPayload;
        if (!cancelled) {
          setData({
            total_points: Number(payload.total_points ?? 0),
            level: payload.level ?? FALLBACK.level,
            progress_ratio: Math.max(0, Math.min(1, Number(payload.progress_ratio ?? 0))),
            points_to_next_level: Math.max(0, Number(payload.points_to_next_level ?? 0)),
          });
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setData(FALLBACK);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const fillWidth = useMemo(() => `${Math.round(data.progress_ratio * 100)}%`, [data.progress_ratio]);

  return (
    <GlassCard className="p-4 max-[900px]:p-2.5">
      <p className="font-sans text-sm text-[#F8F4FF]">
        {loading ? 'Level - ...' : error ? 'Level unavailable' : `Level ${data.level.number} - ${data.level.label}`}
      </p>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        {loading ? (
          <div className="shimmer h-full w-full rounded-full bg-white/20 opacity-60" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF3EA5] to-[#C084FC] transition-all duration-200"
            style={{ width: fillWidth }}
          />
        )}
      </div>

      <p className="mt-1.5 font-sans text-[11px] text-[#B9B4D9]">
        {loading ? 'Loading points...' : error ? 'Unable to read points ledger.' : `${data.total_points} pts • ${data.points_to_next_level} to next`}
      </p>
    </GlassCard>
  );
}
