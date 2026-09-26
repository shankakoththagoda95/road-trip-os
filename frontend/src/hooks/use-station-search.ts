import { useEffect, useState } from 'react';

import { errorMessage } from '@/api/client';
import {
  findNearestStations,
  type NearestStations,
  type StationKind,
} from '@/api/stations';
import type { StationSearchState } from '@/components/trip-overview/stations-dialog';
import type { CurrentPosition } from '@/hooks/use-current-location';

/**
 * Searches for the nearest fuel stations or chargers around the
 * traveller. Without a position yet, it asks for the location and searches
 * once it arrives.
 */
export function useStationSearch({
  position,
  shareLocation,
  onFound,
}: {
  position: CurrentPosition | null;
  shareLocation: () => void;
  // Called with the results (null when a new search starts or is reset).
  onFound?: (result: NearestStations | null) => void;
}) {
  const [search, setSearch] = useState<StationSearchState>({ status: 'idle' });
  const [searchKind, setSearchKind] = useState<StationKind>('fuel');

  // State changes only once the answer is back.
  function fetchStations(from: CurrentPosition, kind: StationKind) {
    return findNearestStations(from.latitude, from.longitude, kind)
      .then((result) => {
        setSearch({ status: 'done', result, from });
        onFound?.(result);
      })
      .catch((error) => {
        setSearch({ status: 'error', message: errorMessage(error) });
      });
  }

  function find(kind: StationKind) {
    onFound?.(null);
    setSearchKind(kind);

    if (position) {
      setSearch({ status: 'searching' });
      void fetchStations(position, kind);
    } else {
      // Ask for the location first; the search starts once it arrives.
      setSearch({ status: 'waiting' });
      shareLocation();
    }
  }

  function reset() {
    onFound?.(null);
    setSearch({ status: 'idle' });
  }

  // A search waiting for the location runs once the position arrives.
  const waitingFor = search.status === 'waiting' && position ? position : null;

  useEffect(() => {
    if (waitingFor) {
      void fetchStations(waitingFor, searchKind);
    }
    // Only when the position arrives for a waiting search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingFor !== null]);

  return { search, find, reset };
}
