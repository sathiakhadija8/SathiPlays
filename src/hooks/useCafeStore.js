'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'sathiplays_cafe_store';

const defaultStore = {
  memoryBooks: {
    friendship: [],
    solo: [],
    pinterest: [],
  },
  magazineEntries: [],
  places: [],
};

function normalizeStore(input) {
  if (!input || typeof input !== 'object') return defaultStore;

  return {
    memoryBooks: {
      friendship: Array.isArray(input?.memoryBooks?.friendship) ? input.memoryBooks.friendship : [],
      solo: Array.isArray(input?.memoryBooks?.solo) ? input.memoryBooks.solo : [],
      pinterest: Array.isArray(input?.memoryBooks?.pinterest) ? input.memoryBooks.pinterest : [],
    },
    magazineEntries: Array.isArray(input?.magazineEntries) ? input.magazineEntries : [],
    places: Array.isArray(input?.places) ? input.places : [],
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || 'Request failed');
  }
  return payload;
}

export function useCafeStore() {
  const [store, setStore] = useState(defaultStore);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const payload = await requestJson('/api/cafe/summary');
      const next = normalizeStore(payload);
      setStore(next);
      setError('');
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cafe data.');
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          setStore(normalizeStore(JSON.parse(raw)));
        } else {
          setStore(defaultStore);
        }
      } catch {
        setStore(defaultStore);
      }
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isLoaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store, isLoaded]);

  const createMemory = useCallback(async (bookKey, memory) => {
    const payload = {
      book_key: bookKey,
      title: memory.title ?? '',
      date: memory.date ?? new Date().toISOString().slice(0, 10),
      mood: memory.mood ?? '',
      note: memory.note ?? '',
      images: Array.isArray(memory.images) ? memory.images : [],
    };
    const data = await requestJson('/api/cafe/memory', { method: 'POST', body: JSON.stringify(payload) });
    const nextEntry = { ...payload, id: String(data.id) };
    setStore((current) => ({
      ...current,
      memoryBooks: {
        ...current.memoryBooks,
        [bookKey]: [nextEntry, ...(current.memoryBooks[bookKey] ?? [])],
      },
    }));
    return nextEntry;
  }, []);

  const updateMemory = useCallback(async (bookKey, memoryId, memory) => {
    const payload = {
      book_key: bookKey,
      title: memory.title ?? '',
      date: memory.date ?? new Date().toISOString().slice(0, 10),
      mood: memory.mood ?? '',
      note: memory.note ?? '',
      images: Array.isArray(memory.images) ? memory.images : [],
    };
    await requestJson(`/api/cafe/memory/${memoryId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await load();
  }, [load]);

  const deleteMemory = useCallback(async (bookKey, memoryId) => {
    await requestJson(`/api/cafe/memory/${memoryId}`, { method: 'DELETE' });
    setStore((current) => ({
      ...current,
      memoryBooks: {
        ...current.memoryBooks,
        [bookKey]: (current.memoryBooks[bookKey] ?? []).filter((entry) => String(entry.id) !== String(memoryId)),
      },
    }));
  }, []);

  const createPlace = useCallback(async (place) => {
    const payload = {
      name: place.name ?? '',
      location: place.location ?? '',
      date: place.date ?? new Date().toISOString().slice(0, 10),
      rating: place.rating ?? 4,
      note: place.note ?? '',
      images: Array.isArray(place.images) ? place.images : [],
      tag: place.tag ?? 'Cafe',
    };
    const data = await requestJson('/api/cafe/places', { method: 'POST', body: JSON.stringify(payload) });
    const nextEntry = { ...payload, id: String(data.id) };
    setStore((current) => ({
      ...current,
      places: [nextEntry, ...current.places],
    }));
    return nextEntry;
  }, []);

  const updatePlace = useCallback(async (placeId, place) => {
    const payload = {
      name: place.name ?? '',
      location: place.location ?? '',
      date: place.date ?? new Date().toISOString().slice(0, 10),
      rating: place.rating ?? 4,
      note: place.note ?? '',
      images: Array.isArray(place.images) ? place.images : [],
      tag: place.tag ?? 'Cafe',
    };
    await requestJson(`/api/cafe/places/${placeId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await load();
  }, [load]);

  const deletePlace = useCallback(async (placeId) => {
    await requestJson(`/api/cafe/places/${placeId}`, { method: 'DELETE' });
    setStore((current) => ({
      ...current,
      places: current.places.filter((entry) => String(entry.id) !== String(placeId)),
    }));
  }, []);

  const createMagazine = useCallback(async (entry) => {
    const payload = {
      label: entry.label ?? '',
      title: entry.title ?? '',
      date: entry.date ?? new Date().toISOString().slice(0, 10),
      a4_template_src: entry.a4_template_src ?? '',
      elements: Array.isArray(entry.elements) ? entry.elements : [],
      cover_preview_image: entry.cover_preview_image ?? '',
    };
    const data = await requestJson('/api/cafe/magazines', { method: 'POST', body: JSON.stringify(payload) });
    const nextEntry = { ...payload, id: String(data.id) };
    setStore((current) => ({
      ...current,
      magazineEntries: [nextEntry, ...current.magazineEntries],
    }));
    return nextEntry;
  }, []);

  const updateMagazine = useCallback(async (entryId, updates) => {
    const payload = {
      label: updates.label ?? '',
      title: updates.title ?? '',
      date: updates.date ?? new Date().toISOString().slice(0, 10),
      a4_template_src: updates.a4_template_src ?? '',
      elements: Array.isArray(updates.elements) ? updates.elements : [],
      cover_preview_image: updates.cover_preview_image ?? '',
    };
    await requestJson(`/api/cafe/magazines/${entryId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await load();
  }, [load]);

  const deleteMagazine = useCallback(async (entryId) => {
    await requestJson(`/api/cafe/magazines/${entryId}`, { method: 'DELETE' });
    setStore((current) => ({
      ...current,
      magazineEntries: current.magazineEntries.filter((entry) => String(entry.id) !== String(entryId)),
    }));
  }, []);

  return useMemo(
    () => ({
      store,
      memoryBooks: store.memoryBooks,
      magazineEntries: store.magazineEntries,
      places: store.places,
      isLoaded,
      error,
      load,
      createMemory,
      updateMemory,
      deleteMemory,
      createPlace,
      updatePlace,
      deletePlace,
      createMagazine,
      updateMagazine,
      deleteMagazine,
    }),
    [
      store,
      isLoaded,
      error,
      load,
      createMemory,
      updateMemory,
      deleteMemory,
      createPlace,
      updatePlace,
      deletePlace,
      createMagazine,
      updateMagazine,
      deleteMagazine,
    ],
  );
}

