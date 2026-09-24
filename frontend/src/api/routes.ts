import { apiRequest } from '@/api/client';
import type { TripType } from '@/api/trips';

export type GeocodeResult = {
  query: string;
  display_name: string;
  latitude: number;
  longitude: number;
};

export type RoutePointInput = {
  location: string;
  latitude?: number;
  longitude?: number;
};

export type RoutePreviewRequest = {
  start: RoutePointInput;
  destination: RoutePointInput;
  stops: RoutePointInput[];
  trip_type: TripType;
};

export type RoutePoint = {
  location: string;
  latitude: number;
  longitude: number;
  kind: 'start' | 'stop' | 'destination';
};

export type RouteLeg = {
  from_location: string;
  to_location: string;
  distance_meters: number;
  duration_seconds: number;
};

export type RouteGeometry = {
  type: 'LineString';
  // [longitude, latitude] pairs (GeoJSON order).
  coordinates: [number, number][];
};

export type RoutePreview = {
  distance_meters: number;
  duration_seconds: number;
  points: RoutePoint[];
  legs: RouteLeg[];
  geometry: RouteGeometry;
};

export function geocode(query: string) {
  return apiRequest<GeocodeResult>('/routes/geocode', {
    method: 'POST',
    body: { query },
  });
}

export function previewRoute(request: RoutePreviewRequest) {
  return apiRequest<RoutePreview>('/routes/preview', {
    method: 'POST',
    body: request,
  });
}

export type EnergyStopsRequest = RoutePreviewRequest & {
  vehicle_id: number;
  start_level_percent: number;
  reserve_percent: number;
  refill_to_percent: number;
};

export type EnergyStation = {
  provider_id: string;
  name: string;
  latitude: number;
  longitude: number;
  // e.g. ["diesel", "petrol 95"] or ["150 kW", "CCS"].
  details: string[];
};

export type EnergyStop = {
  distance_from_start_km: number;
  latitude: number;
  longitude: number;
  // Null when no station was found near this part of the route.
  station: EnergyStation | null;
  distance_from_route_km: number | null;
};

export type EnergyPlan = {
  mode: 'fuel' | 'ev';
  full_range_km: number;
  total_distance_km: number;
  stops: EnergyStop[];
  warnings: string[];
};

export function planEnergyStops(request: EnergyStopsRequest) {
  return apiRequest<EnergyPlan>('/routes/energy-stops', {
    method: 'POST',
    body: request,
  });
}

export type RouteConditionsRequest = RoutePreviewRequest & {
  // Local wall-clock time, e.g. `2026-10-01T09:00:00`.
  departure_at: string;
  max_driving_hours_per_day: number | null;
};

export type DailyForecast = {
  temperature_max_c: number;
  temperature_min_c: number;
  precipitation_probability: number;
  wind_speed_max_kmh: number;
  // WMO weather code.
  weather_code: number;
};

export type RoutePointWeather = {
  location: string;
  kind: RoutePoint['kind'];
  latitude: number;
  longitude: number;
  // Estimated day this point is reached (`YYYY-MM-DD`).
  date: string;
  forecast_available: boolean;
  forecast: DailyForecast | null;
};

export type TerrainSummary = {
  total_ascent_m: number;
  total_descent_m: number;
  max_elevation_m: number;
  min_elevation_m: number;
  elevation_range_m: number;
};

export type ElevationProfilePoint = {
  distance_km: number;
  elevation_m: number;
};

export type RouteConditions = {
  weather: RoutePointWeather[];
  terrain: TerrainSummary | null;
  elevation_profile: ElevationProfilePoint[];
  warnings: string[];
  // Data sources that failed, e.g. ["elevation"].
  unavailable: string[];
};

export function getRouteConditions(request: RouteConditionsRequest) {
  return apiRequest<RouteConditions>('/routes/conditions', {
    method: 'POST',
    body: request,
  });
}

export type RouteFeesRequest = RoutePreviewRequest & {
  vehicle_type: 'car' | 'motorcycle' | 'campervan' | 'van' | null;
};

export type RouteCountry = {
  // ISO 3166-1 alpha-2, e.g. "SE".
  code: string;
  name: string;
  distance_km: number;
};

export type BorderCrossing = {
  from_code: string;
  from_country: string;
  to_code: string;
  to_country: string;
  latitude: number;
  longitude: number;
  distance_from_start_km: number;
};

export type RoadFeeKind =
  | 'vignette'
  | 'distance'
  | 'toll_stations'
  | 'crossing'
  | 'info';

export type RoadFee = {
  name: string;
  country_code: string;
  kind: RoadFeeKind;
  // Approximate price in EUR; null for information-only entries.
  amount_eur: number | null;
  note: string;
  url: string | null;
};

export type RouteFees = {
  countries: RouteCountry[];
  crossings: BorderCrossing[];
  fees: RoadFee[];
  total_eur: number;
  notes: string[];
};

export function getRouteFees(request: RouteFeesRequest) {
  return apiRequest<RouteFees>('/routes/fees', {
    method: 'POST',
    body: request,
  });
}

export type ItineraryPreviewRequest = RoutePreviewRequest & {
  // Local wall-clock time, e.g. `2026-10-01T09:00:00`.
  departure_at: string;
  duration_days: number;
  max_distance_per_day: number | null;
  max_driving_hours_per_day: number | null;
};

export type LimitStatus = 'within_limit' | 'within_tolerance' | 'exceeds_limit';

export type ItineraryDay = {
  // Day of the trip, 1 = departure day.
  day_number: number;
  // `YYYY-MM-DD`.
  date: string;
  driving: boolean;
  // Where the day starts / ends; the same place on free days.
  from_location: string;
  to_location: string;
  distance_meters: number;
  duration_seconds: number;
  distance_status: LimitStatus | null;
  driving_time_status: 'within_limit' | 'exceeds_limit' | null;
  legs: RouteLeg[];
};

export type ItineraryPreview = {
  distance_meters: number;
  duration_seconds: number;
  days: ItineraryDay[];
  driving_days: number;
  // Why the plan doesn't work as-is.
  problems: string[];
};

export function previewItinerary(request: ItineraryPreviewRequest) {
  return apiRequest<ItineraryPreview>('/routes/itinerary', {
    method: 'POST',
    body: request,
  });
}
