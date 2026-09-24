import { apiRequest } from '@/api/client';

export type TripType = 'one_way' | 'round_trip';

export type Trip = {
  id: number;
  user_id: number;
  name: string;
  start_location: string;
  destination: string;
  trip_type: TripType;
  departure_at: string;
  travelers: number;
  duration_days: number;
  vehicle_id: number | null;
  max_driving_hours_per_day: number | null;
  max_distance_per_day: number | null;
};

export function listTrips() {
  return apiRequest<Trip[]>('/trips/');
}

export type TripCreate = {
  name: string;
  start_location: string;
  destination: string;
  trip_type: Trip['trip_type'];
  // Local wall-clock time without an offset, e.g. `2026-10-01T09:00:00`.
  departure_at: string;
  travelers: number;
  duration_days: number;
  vehicle_id?: number | null;
  max_driving_hours_per_day?: number | null;
  max_distance_per_day?: number | null;
};

export function createTrip(data: TripCreate) {
  return apiRequest<Trip>('/trips/', { method: 'POST', body: data });
}

export type TripDestinationCreate = {
  location: string;
  stop_order: number;
  latitude: number;
  longitude: number;
};

export function addTripDestination(
  tripId: number,
  destination: TripDestinationCreate,
) {
  return apiRequest<TripDestinationCreate & { id: number; trip_id: number }>(
    `/trips/${tripId}/destinations/`,
    { method: 'POST', body: destination },
  );
}
