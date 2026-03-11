'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FinanceView } from '../lib/finance-api';
import { financeApiUrl } from '../lib/finance-api';

export type FinanceSummary = {
  month: string;
  view: FinanceView;
  balance: number;
  cards: number;
  total_budget: number;
  spent_today: number;
  spent_week: number;
  spent_month: number;
  budget_remaining_pct: number;
  avg_per_day: number;
  trend_pct: number;
  top_category: { name: string; amount: number } | null;
  top_alert_categories?: Array<{
    category: string;
    spent: number;
    limit: number;
    used_pct: number;
    remaining: number;
    is_close: boolean;
    is_over: boolean;
  }>;
};

export function useFinanceSummary(month: string, view: FinanceView) {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          financeApiUrl('/finance/summary', { month, view }),
          { cache: 'no-store', signal: controller.signal },
        );
        const payload = (await response.json()) as FinanceSummary | { message?: string };
        if (!response.ok) throw new Error((payload as { message?: string }).message || 'Unable to load finance summary.');
        setData(payload as FinanceSummary);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load finance summary.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [month, view, nonce]);

  return { data, loading, error, refetch };
}
