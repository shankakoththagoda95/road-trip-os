import { apiRequest } from '@/api/client';

export type RoadConditionLevel = 'good' | 'caution' | 'poor';

export type VisibilityRating = 'excellent' | 'good' | 'moderate' | 'poor';

export type HourlyForecast = {
  // Local time at the place, e.g. `2026-09-25T19:00`.
  time: string;
  temperature_c: number;
  weather_code: number;
  precipitation_probability: number;
};

export type CurrentConditions = {
  latitude: number;
  longitude: number;
  temperature_c: number;
  // WMO weather code.
  weather_code: number;
  wind_speed_kmh: number;
  visibility_m: number | null;
  visibility: VisibilityRating | null;
  // Today, in the place's own time zone.
  temperature_max_c: number;
  temperature_min_c: number;
  precipitation_probability: number;
  // Weather-based only (no closures or road works).
  road_conditions: { level: RoadConditionLevel; label: string };
  // From the current hour on, when asked for.
  next_hours: HourlyForecast[];
};

/**
 * Weather right now at a place, with today's range and a road rating.
 */
export function getCurrentConditions(
  latitude: number,
  longitude: number,
  // Also fetch the forecast for this many hours from now.
  hours = 0,
) {
  return apiRequest<CurrentConditions>(
    `/weather/now?latitude=${latitude}&longitude=${longitude}&hours=${hours}`,
  );
}
