import { apiRequest } from '@/api/client';

export type StationKind = 'fuel' | 'charging';

export type NearestStation = {
  provider_id: string;
  name: string;
  latitude: number;
  longitude: number;
  // Straight-line distance from the search point.
  distance_km: number;
  operator: string | null;
  // Fuel: e.g. "diesel", "petrol_95". Chargers: connector names.
  details: string[];
  // Chargers: fastest connector.
  power_kw: number | null;
};

export type NearestStations = {
  kind: StationKind;
  // Smallest whole-km radius with at least one station; null when there's
  // none within `searched_up_to_km`.
  radius_km: number | null;
  searched_up_to_km: number;
  // Nearest first.
  stations: NearestStation[];
};

/**
 * The nearest fuel stations or chargers, growing the search radius 1 km at
 * a time until at least one is found (up to 50 km).
 */
export function findNearestStations(
  latitude: number,
  longitude: number,
  kind: StationKind,
) {
  return apiRequest<NearestStations>(
    `/stations/nearest?latitude=${latitude}&longitude=${longitude}&kind=${kind}`,
  );
}
