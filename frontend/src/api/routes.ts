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
