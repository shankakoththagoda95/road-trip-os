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

export type TripBudgetCreate = {
  currency: string;
  estimated_fuel_cost: number;
  estimated_ev_charging_cost: number;
  estimated_toll_cost: number;
  estimated_food_cost: number;
  estimated_parking_cost: number;
  estimated_other_cost: number;
};

export function createTripBudget(tripId: number, budget: TripBudgetCreate) {
  return apiRequest<TripBudgetCreate & { id: number; estimated_total: number }>(
    `/trips/${tripId}/budget/`,
    { method: 'POST', body: budget },
  );
}

export function createTripFuel(tripId: number, startingFuelLiters: number) {
  return apiRequest(`/trips/${tripId}/fuel/`, {
    method: 'POST',
    body: {
      starting_fuel: startingFuelLiters,
      current_fuel: startingFuelLiters,
      fuel_used: 0,
      fuel_cost: 0,
    },
  });
}

export function createTripEv(tripId: number, startingBatteryPercent: number) {
  return apiRequest(`/trips/${tripId}/ev/`, {
    method: 'POST',
    body: { starting_battery_percentage: startingBatteryPercent },
  });
}

// Splits the saved trip into driving days and stores them (used for the
// calendar export).
export function createItinerary(tripId: number) {
  return apiRequest(`/itineraries/trips/${tripId}/itinerary`, {
    method: 'POST',
  });
}
