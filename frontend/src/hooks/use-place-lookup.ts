import { useEffect, useSyncExternalStore } from 'react';

import { ApiError } from '@/api/client';
import { lookupPlace, type PlaceLookup } from '@/api/places';
import { placeKey } from '@/utils/place-key';

export type PlaceLookupState =
  | { status: 'idle' | 'loading' | 'missing' | 'unavailable'; place: null }
  | { status: 'found'; place: PlaceLookup };

// Shared by every card on the page and kept while the app is open, so a
// place is only looked up once. Components read it through
// useSyncExternalStore and re-render when `notify` runs.
const lookups = new Map<string, Promise<PlaceLookup | null>>();
// null = no match (or the lookup failed).
const results = new Map<string, PlaceLookup | null>();
const listeners = new Set<() => void>();

// Set once the server says it has no Google key; stops further requests.
let notConfigured = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function remember(key: string, place: PlaceLookup | null) {
  results.set(key, place);
  notify();
}

function cachedLookup(text: string) {
  const key = placeKey(text);
  let pending = lookups.get(key);

  if (!pending) {
    pending = lookupPlace(text)
      .then((place) => {
        // A search adds the place under Google's name; don't look it up again.
        const nameKey = placeKey(place.name);
        lookups.set(nameKey, Promise.resolve(place));
        results.set(nameKey, place);
        remember(key, place);
        return place;
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 404) {
          remember(key, null);
          return null;
        }

        if (error instanceof ApiError && error.code === 'places_not_configured') {
          notConfigured = true;
          notify();
        }

        // Let a later search try again.
        lookups.delete(key);
        throw error;
      });

    lookups.set(key, pending);
  }

  return pending;
}

// Stable values (the stored object, null, or a marker) so
// useSyncExternalStore only re-renders on a real change.
function snapshotFor(key: string) {
  if (!key) return 'idle' as const;
  if (notConfigured) return 'unavailable' as const;
  if (!results.has(key)) return 'loading' as const;
  return results.get(key) ?? null;
}

/**
 * Google place details and photo for a typed place name.
 */
export function usePlaceLookup(text: string): PlaceLookupState {
  const trimmed = text.trim();
  const key = trimmed ? placeKey(trimmed) : '';

  const snapshot = useSyncExternalStore(
    subscribe,
    () => snapshotFor(key),
    () => snapshotFor(key),
  );

  useEffect(() => {
    if (!key || notConfigured || results.has(key)) {
      return;
    }

    cachedLookup(trimmed).catch(() => {
      // No photo; the card shows a placeholder.
      if (!notConfigured) {
        remember(key, null);
      }
    });
  }, [key, trimmed]);

  if (snapshot === null) return { status: 'missing', place: null };
  if (typeof snapshot === 'string') return { status: snapshot, place: null };
  return { status: 'found', place: snapshot };
}

export { cachedLookup as lookupPlaceCached };
