'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { financeApiUrl } from '../lib/finance-api';

export type FinanceTransaction = {
  id: number;
  amount: number;
  direction: 'expense' | 'income';
  category: string;
  note: string | null;
  date: string;
  created_at?: string;
};

export function useFinanceTransactions(month: string, limit = 10, category?: string) {
  const [data, setData] = useState<FinanceTransaction[]>([]);
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
          financeApiUrl('/finance/transactions', {
            month,
            limit,
            category,
          }),
          { cache: 'no-store', signal: controller.signal },
        );
        const payload = (await response.json()) as FinanceTransaction[] | { message?: string };
        if (!response.ok) throw new Error((payload as { message?: string }).message || 'Unable to load transactions.');
        setData(Array.isArray(payload) ? payload : []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load transactions.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [month, limit, category, nonce]);

  const expenses = useMemo(() => data.filter((item) => item.direction === 'expense'), [data]);

  return { data, expenses, loading, error, refetch };
}
