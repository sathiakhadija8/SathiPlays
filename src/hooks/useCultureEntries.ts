'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CultureItem } from '../components/CultureClub/CultureCard';
import type { CultureType } from '../components/CultureClub/CultureTabs';

const STORAGE_KEY = 'sathiplays_culture_entries_v1';

async function fetchEntriesApi(type?: CultureType, signal?: AbortSignal): Promise<CultureItem[]> {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  const response = await fetch(`/api/culture/entries${query}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Failed to fetch entries');
  return (await response.json()) as CultureItem[];
}

async function createEntryApi(entry: CultureItem): Promise<{ insertedId: number }> {
  const response = await fetch('/api/culture/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  const payload = (await response.json()) as { ok?: boolean; insertedId?: number; message?: string };
  if (!response.ok || !payload.ok || !payload.insertedId) {
    throw new Error(payload.message ?? 'Failed to create entry');
  }
  return { insertedId: payload.insertedId };
}

async function updateEntryApi(entry: CultureItem): Promise<void> {
  const response = await fetch(`/api/culture/entries/${entry.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Failed to update entry');
  }
}

async function deleteEntryApi(id: number): Promise<void> {
  const response = await fetch(`/api/culture/entries/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? 'Failed to delete entry');
  }
}

export function useCultureEntries(initialEntries: CultureItem[] = []) {
  const [entries, setEntries] = useState<CultureItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const persistCache = useCallback((next: CultureItem[]) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore local cache failures.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const apiItems = await fetchEntriesApi(undefined, controller.signal);
        if (!alive) return;
        setEntries(apiItems);
        persistCache(apiItems);
      } catch {
        if (!alive) return;
        try {
          const cached = window.localStorage.getItem(STORAGE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as CultureItem[];
            setEntries(Array.isArray(parsed) ? parsed : initialEntries);
          } else {
            setEntries(initialEntries);
          }
        } catch {
          setEntries(initialEntries);
        }
        setError('Using offline cache. Culture DB connection unavailable.');
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    void load();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [initialEntries, persistCache]);

  const createEntry = useCallback(
    async (entry: CultureItem) => {
      setError(null);
      try {
        const { insertedId } = await createEntryApi(entry);
        setEntries((prev) => {
          const next = [{ ...entry, id: insertedId }, ...prev];
          persistCache(next);
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to create entry');
      }
    },
    [persistCache],
  );

  const updateEntry = useCallback(
    async (entry: CultureItem) => {
      setError(null);
      try {
        await updateEntryApi(entry);
        setEntries((prev) => {
          const next = prev.map((item) => (item.id === entry.id ? entry : item));
          persistCache(next);
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to update entry');
      }
    },
    [persistCache],
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      setError(null);
      try {
        await deleteEntryApi(id);
        setEntries((prev) => {
          const next = prev.filter((item) => item.id !== id);
          persistCache(next);
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to delete entry');
      }
    },
    [persistCache],
  );

  return useMemo(
    () => ({
      entries,
      isLoading,
      error,
      createEntry,
      updateEntry,
      deleteEntry,
    }),
    [entries, isLoading, error, createEntry, updateEntry, deleteEntry],
  );
}

