import { apiDownload, apiRequest } from '@/api/client';
import type { RouteGeometry, RoutePoint } from '@/api/routes';

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
  // Nights at the destination (the last stop).
  destination_nights: number;
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
  destination_nights?: number;
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
  // Omit (null) to let the backend look the place up.
  latitude: number | null;
  longitude: number | null;
  // Nights spent here before driving on.
  nights?: number;
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

export type TripFuel = {
  trip_id: number;
  // Litres in the tank when setting off.
  starting_fuel: number;
};

export type TripEv = {
  trip_id: number;
  starting_battery_percentage: number;
};

// 404 (ApiError) when the trip has no starting level saved.
export function getTripFuel(tripId: number) {
  return apiRequest<TripFuel>(`/trips/${tripId}/fuel/`);
}

export function getTripEv(tripId: number) {
  return apiRequest<TripEv>(`/trips/${tripId}/ev/`);
}

/**
 * Store where the traveller is (builds the trip's GPS track).
 */
export function recordTripLocation(
  tripId: number,
  latitude: number,
  longitude: number,
) {
  return apiRequest(`/trips/${tripId}/locations`, {
    method: 'POST',
    body: { latitude, longitude },
  });
}

// Splits the saved trip into driving days and stores them (used for the
// calendar export).
export function createItinerary(tripId: number) {
  return apiRequest(`/itineraries/trips/${tripId}/itinerary`, {
    method: 'POST',
  });
}

export type TripUpdate = Omit<TripCreate, 'vehicle_id'> & {
  vehicle_id: number | null;
};

export function getTrip(tripId: number) {
  return apiRequest<Trip>(`/trips/${tripId}`);
}

export function updateTrip(tripId: number, data: TripUpdate) {
  return apiRequest<Trip>(`/trips/${tripId}`, { method: 'PUT', body: data });
}

export function deleteTrip(tripId: number) {
  return apiRequest(`/trips/${tripId}`, { method: 'DELETE' });
}

// --- Stops ---

export type TripDestination = TripDestinationCreate & {
  id: number;
  trip_id: number;
};

export function listTripDestinations(tripId: number) {
  return apiRequest<TripDestination[]>(`/trips/${tripId}/destinations/`);
}

export function updateTripDestination(
  tripId: number,
  destinationId: number,
  destination: TripDestinationCreate,
) {
  return apiRequest<TripDestination>(
    `/trips/${tripId}/destinations/${destinationId}`,
    { method: 'PUT', body: destination },
  );
}

export function deleteTripDestination(tripId: number, destinationId: number) {
  return apiRequest(`/trips/${tripId}/destinations/${destinationId}`, {
    method: 'DELETE',
  });
}

// --- Route ---

export type TripRouteLeg = {
  from_location: string;
  to_location: string;
  distance_meters: number;
  duration_seconds: number;
};

export type TripRouteDay = {
  // Day of the trip, 1 = departure day.
  day_number: number;
  total_distance_meters: number;
  total_duration_seconds: number;
  distance_status: 'within_limit' | 'within_tolerance' | 'exceeds_limit';
  driving_time_status: 'within_limit' | 'exceeds_limit';
  legs: TripRouteLeg[];
};

export type TripRoute = {
  trip_id: number;
  distance_meters: number;
  duration_seconds: number;
  legs: TripRouteLeg[];
  days: TripRouteDay[];
  geometry: RouteGeometry | null;
  points: RoutePoint[];
  // Why the days couldn't be planned (e.g. a leg over the daily limit).
  problems: string[];
};

export function getTripRoute(tripId: number) {
  return apiRequest<TripRoute>(`/trips/${tripId}/route`);
}

// --- Budget ---

export type TripBudget = TripBudgetCreate & {
  id: number;
  trip_id: number;
  actual_fuel_cost: number;
  actual_ev_charging_cost: number;
  actual_toll_cost: number;
  actual_food_cost: number;
  actual_parking_cost: number;
  actual_other_cost: number;
  estimated_total: number;
  actual_total: number;
  remaining_budget: number;
};

// 404 (ApiError) when the trip has no budget yet.
export function getTripBudget(tripId: number) {
  return apiRequest<TripBudget>(`/trips/${tripId}/budget/`);
}

export function updateTripBudget(
  tripId: number,
  budget: TripBudgetCreate & Partial<TripBudget>,
) {
  return apiRequest<TripBudget>(`/trips/${tripId}/budget/`, {
    method: 'PUT',
    body: budget,
  });
}

// --- Itinerary & calendar ---

// 404 (ApiError) until an itinerary has been saved.
export function getSavedItinerary(tripId: number) {
  return apiRequest<{
    id: number;
    days: { day_number: number; total_distance_meters: number }[];
  }>(
    `/itineraries/trips/${tripId}/itinerary`,
  );
}

export function downloadTripCalendar(tripId: number) {
  return apiDownload(`/itineraries/trips/${tripId}/calendar.ics`);
}
