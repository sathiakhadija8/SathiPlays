'use client';

import { useCallback, useEffect, useState } from 'react';
import { financeApiUrl } from '../lib/finance-api';

export type FinanceChartPoint = {
  label: string;
  value: number;
};

type FinanceChartResponse = {
  view: 'week' | 'month';
  labels: string[];
  series: Array<{ name: string; data: number[] }>;
};

export function useFinanceChart(month: string, view: 'week' | 'month', enabled: boolean) {
  const [data, setData] = useState<FinanceChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          financeApiUrl('/finance/chart', { month, view }),
          { cache: 'no-store', signal: controller.signal },
        );
        const payload = (await response.json()) as FinanceChartResponse | { message?: string };
        if (!response.ok) throw new Error((payload as { message?: string }).message || 'Unable to load chart.');

        const chart = payload as FinanceChartResponse;
        const series = chart.series?.[0]?.data ?? [];
        const next = (chart.labels ?? []).map((label, index) => ({ label, value: Number(series[index] ?? 0) }));
        setData(next);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load chart.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [month, view, enabled, nonce]);

  return { data, loading, error, refetch };
}
