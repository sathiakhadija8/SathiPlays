'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'sathiplays_travel_store_v2';

const DEFAULT_STATE = {
  trips: [],
  dreamDestinations: [],
  plannerData: {},
};

function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function toCacheState(state) {
  if (!state || typeof state !== 'object') return DEFAULT_STATE;

  const trips = Array.isArray(state.trips)
    ? state.trips.map((trip) => ({
      ...trip,
      coverImage: isDataUrl(trip?.coverImage) ? '' : (trip?.coverImage || ''),
      gallery: Array.isArray(trip?.gallery) ? trip.gallery.filter((value) => typeof value === 'string' && !isDataUrl(value)) : [],
    }))
    : [];

  const dreamDestinations = Array.isArray(state.dreamDestinations)
    ? state.dreamDestinations.map((dream) => ({
      ...dream,
      image: isDataUrl(dream?.image) ? '' : (dream?.image || ''),
    }))
    : [];

  return {
    trips,
    dreamDestinations,
    plannerData: state.plannerData && typeof state.plannerData === 'object' ? state.plannerData : {},
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATE;
  return {
    trips: Array.isArray(raw.trips) ? raw.trips : [],
    dreamDestinations: Array.isArray(raw.dreamDestinations) ? raw.dreamDestinations : [],
    plannerData: raw.plannerData && typeof raw.plannerData === 'object' ? raw.plannerData : {},
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

export function useTravelStore() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const payload = await requestJson('/api/travel/summary');
      const next = normalizeState(payload);
      setState(next);
      setError('');
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toCacheState(next)));
      } catch {
        // ignore cache failures (for example quota exceeded)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load travel data.');
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          setState(normalizeState(JSON.parse(raw)));
        } else {
          setState(DEFAULT_STATE);
        }
      } catch {
        setState(DEFAULT_STATE);
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
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toCacheState(state)));
    } catch {
      // ignore
    }
  }, [state, isLoaded]);

  const addTrip = useCallback(async (payload) => {
    const data = await requestJson('/api/travel/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await load();
    return String(data.id);
  }, [load]);

  const updateTrip = useCallback(async (trip) => {
    await requestJson(`/api/travel/trips/${trip.id}`, {
      method: 'PATCH',
      body: JSON.stringify(trip),
    });
    await load();
  }, [load]);

  const deleteTrip = useCallback(async (tripId) => {
    await requestJson(`/api/travel/trips/${tripId}`, { method: 'DELETE' });
    setState((prev) => {
      const plannerData = { ...prev.plannerData };
      delete plannerData[String(tripId)];
      return {
        ...prev,
        trips: prev.trips.filter((trip) => String(trip.id) !== String(tripId)),
        plannerData,
      };
    });
  }, []);

  const addDream = useCallback(async (payload) => {
    const data = await requestJson('/api/travel/dreams', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await load();
    return String(data.id);
  }, [load]);

  const updateDream = useCallback(async (dream) => {
    await requestJson(`/api/travel/dreams/${dream.id}`, {
      method: 'PATCH',
      body: JSON.stringify(dream),
    });
    await load();
  }, [load]);

  const moveDreamToTrip = useCallback(async (dreamId) => {
    const data = await requestJson(`/api/travel/dreams/${dreamId}/move`, {
      method: 'POST',
    });
    await load();
    return String(data.tripId);
  }, [load]);

  const updatePlanner = useCallback(async (tripId, planner) => {
    await requestJson('/api/travel/planner', {
      method: 'PATCH',
      body: JSON.stringify({ tripId, planner }),
    });
    setState((prev) => ({
      ...prev,
      plannerData: {
        ...prev.plannerData,
        [String(tripId)]: planner,
      },
    }));
  }, []);

  const deleteTripImage = useCallback(async (tripId, imageUrl) => {
    const trip = state.trips.find((entry) => String(entry.id) === String(tripId));
    if (!trip) return;

    const nextGallery = (trip.gallery || []).filter((img) => img !== imageUrl);
    const nextCoverImage = trip.coverImage === imageUrl ? nextGallery[0] || '/Images/background.png' : trip.coverImage;
    await updateTrip({
      ...trip,
      coverImage: nextCoverImage,
      gallery: nextGallery,
    });
  }, [state.trips, updateTrip]);

  return useMemo(
    () => ({
      trips: state.trips,
      dreamDestinations: state.dreamDestinations,
      plannerData: state.plannerData,
      isLoaded,
      error,
      load,
      addTrip,
      updateTrip,
      deleteTrip,
      addDream,
      updateDream,
      moveDreamToTrip,
      updatePlanner,
      deleteTripImage,
    }),
    [
      state.trips,
      state.dreamDestinations,
      state.plannerData,
      isLoaded,
      error,
      load,
      addTrip,
      updateTrip,
      deleteTrip,
      addDream,
      updateDream,
      moveDreamToTrip,
      updatePlanner,
      deleteTripImage,
    ],
  );
}
