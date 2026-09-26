import type { GeocodeResult } from '@/api/routes';
import type { RoutePlace } from '@/hooks/use-trip-draft';

/**
 * A geocoder match as a route place, keeping what the user typed.
 */
export function toPlace(location: string, result: GeocodeResult): RoutePlace {
  return {
    location,
    displayName: result.display_name,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}
