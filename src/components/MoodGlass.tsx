'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { GlassCard } from './GlassCard';
import {
  type MoodMode,
  type MoodRangeResponse,
  formatDayLabel,
  formatHHMM,
  isTodayPoints,
} from '../lib/mood-helpers';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type LatestMood = {
  id: number;
  mood_value: number;
  created_at: string;
} | null;

const MODES: MoodMode[] = ['today', '7d', '30d'];

export function MoodGlass() {
  const [mode, setMode] = useState<MoodMode>('7d');
  const [sliderValue, setSliderValue] = useState(50);
  const [latest, setLatest] = useState<LatestMood>(null);
  const [rangeData, setRangeData] = useState<MoodRangeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggedFlash, setLoggedFlash] = useState(false);

  const fetchLatest = useCallback(async () => {
    const response = await fetch('/api/mood/latest', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch latest mood.');
    }

    const payload = (await response.json()) as LatestMood;
    setLatest(payload);
    if (payload) {
      setSliderValue(payload.mood_value);
    }
  }, []);

  const fetchRange = useCallback(async (nextMode: MoodMode) => {
    const response = await fetch(`/api/mood/range?mode=${nextMode}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch mood range.');
    }

    const payload = (await response.json()) as MoodRangeResponse;
    setRangeData(payload);
  }, []);

  const refresh = useCallback(
    async (nextMode: MoodMode) => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchLatest(), fetchRange(nextMode)]);
      } catch {
        setError('Unable to load mood data right now.');
      } finally {
        setLoading(false);
      }
    },
    [fetchLatest, fetchRange],
  );

  useEffect(() => {
    refresh(mode);
  }, [mode, refresh]);

  const onLogMood = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood_value: sliderValue }),
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      await refresh(mode);
      setLoggedFlash(true);
      window.setTimeout(() => setLoggedFlash(false), 1400);
    } catch {
      setError('Could not log mood. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  const chartData = useMemo(() => {
    if (!rangeData) {
      return { labels: [] as string[], values: [] as number[] };
    }

    if (isTodayPoints(rangeData.points)) {
      return {
        labels: rangeData.points.map((item) => formatHHMM(item.created_at)),
        values: rangeData.points.map((item) => item.mood_value),
      };
    }

    return {
      labels: rangeData.points.map((item) => formatDayLabel(item.day)),
      values: rangeData.points.map((item) => Number(item.avg_value)),
    };
  }, [rangeData]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(18,16,40,0.92)',
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 1,
          titleColor: '#F8F4FF',
          bodyColor: '#F8F4FF',
        },
      },
      scales: {
        x: {
          ticks: { color: '#B9B4D9', maxTicksLimit: mode === 'today' ? 6 : 7 },
          grid: { color: 'rgba(255,255,255,0.07)' },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: '#B9B4D9', stepSize: 25 },
          grid: { color: 'rgba(255,255,255,0.07)' },
        },
      },
    }),
    [mode],
  );

  const chartDataset = useMemo(
    () => ({
      labels: chartData.labels,
      datasets: [
        {
          data: chartData.values,
          borderColor: '#FF3EA5',
          pointBackgroundColor: '#FF3EA5',
          pointBorderColor: '#FF3EA5',
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.34,
          fill: true,
          backgroundColor: 'rgba(255, 62, 165, 0.12)',
        },
      ],
    }),
    [chartData.labels, chartData.values],
  );

  return (
    <GlassCard depth="main" className="flex h-full min-h-0 flex-col p-3 max-[900px]:p-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-serif text-xl text-[#F8F4FF]">Mood</h2>
        <p className="font-sans text-xs text-[#B9B4D9]">Last logged {latest ? formatHHMM(latest.created_at) : '--:--'}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 max-[900px]:p-2">
        <div className="mb-2 flex items-center justify-between font-sans text-xs text-[#B9B4D9]">
          <span>Saddest</span>
          <span className="text-[#F8F4FF]">{sliderValue}</span>
          <span>Happiest</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={sliderValue}
          onChange={(event) => setSliderValue(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#FF3EA5]"
          aria-label="Mood meter"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onLogMood}
            disabled={saving}
            className={`interactive-cta rounded-full border border-[#FF3EA560] bg-[#FF3EA51A] px-3 py-1 font-sans text-xs text-[#F8F4FF] transition-all duration-300 hover:bg-[#FF3EA533] ${loggedFlash ? 'animate-log-glow' : ''}`}
          >
            {saving ? 'Logging...' : 'Log Mood'}
          </button>
          <span
            className={`font-sans text-xs text-[#FF86C8] transition-opacity duration-500 ${
              loggedFlash ? 'opacity-100' : 'opacity-0'
            }`}
          >
            Logged ✓
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {MODES.map((pillMode) => (
          <button
            key={pillMode}
            type="button"
            onClick={() => setMode(pillMode)}
            className={`rounded-full border px-3 py-1 font-sans text-xs uppercase tracking-wide transition-all duration-300 hover:-translate-y-[1px] ${
              mode === pillMode
                ? 'border-[#FF3EA560] bg-[#FF3EA522] text-[#F8F4FF]'
                : 'border-white/10 bg-white/5 text-[#B9B4D9]'
            }`}
          >
            {pillMode}
          </button>
        ))}
      </div>

      <div className="mt-2 min-h-0 flex-1 rounded-2xl border border-white/10 bg-black/20 p-2 max-[900px]:mt-1.5 max-[900px]:p-1.5">
        {loading ? (
          <div className="shimmer h-full w-full rounded-xl bg-white/10" />
        ) : error ? (
          <div className="grid h-full place-items-center">
            <p className="font-sans text-xs text-[#FF86C8]">{error}</p>
          </div>
        ) : chartData.values.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="font-sans text-xs text-[#B9B4D9]">No mood logs yet for this range.</p>
          </div>
        ) : (
          <div className="h-[150px] w-full max-[900px]:h-[122px]">
            <Line data={chartDataset} options={chartOptions} />
          </div>
        )}
      </div>
    </GlassCard>
  );
}
