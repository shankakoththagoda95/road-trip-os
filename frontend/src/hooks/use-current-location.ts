import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

export type CurrentPosition = {
  latitude: number;
  longitude: number;
  // Metres, when known.
  accuracy: number | null;
  timestamp: number;
};

export type LocationState =
  // Not asked yet (the user hasn't pressed "Share my location").
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'tracking'; position: CurrentPosition }
  | { status: 'denied' }
  | { status: 'unavailable'; message: string };

/**
 * The traveller's position, followed while the screen is open. Asks for
 * permission only when `start` is called; if it was already granted,
 * tracking starts by itself.
 */
export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({ status: 'idle' });
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const mounted = useRef(true);

  const follow = useCallback(async () => {
    setState((current) =>
      current.status === 'tracking' ? current : { status: 'locating' },
    );

    try {
      subscription.current?.remove();
      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          // Enough for progress along a road; saves battery.
          distanceInterval: 50,
          timeInterval: 15_000,
        },
        (location) => {
          if (!mounted.current) return;
          setState({
            status: 'tracking',
            position: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy ?? null,
              timestamp: location.timestamp,
            },
          });
        },
      );
    } catch (error) {
      if (mounted.current) {
        setState({
          status: 'unavailable',
          message:
            error instanceof Error
              ? error.message
              : "Your location isn't available.",
        });
      }
    }
  }, []);

  const start = useCallback(async () => {
    setState({ status: 'locating' });

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!mounted.current) return;

      if (permission.status !== 'granted') {
        setState({ status: 'denied' });
        return;
      }

      await follow();
    } catch (error) {
      if (mounted.current) {
        setState({
          status: 'unavailable',
          message:
            error instanceof Error
              ? error.message
              : "Your location isn't available.",
        });
      }
    }
  }, [follow]);

  useEffect(() => {
    mounted.current = true;

    // Already allowed (e.g. on an earlier visit): start without asking.
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (mounted.current && permission.status === 'granted') {
          void follow();
        }
      })
      .catch(() => {
        // Permission state unknown; wait for the user to ask.
      });

    return () => {
      mounted.current = false;
      subscription.current?.remove();
      subscription.current = null;
    };
  }, [follow]);

  return { state, start };
}
