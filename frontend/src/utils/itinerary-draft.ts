import type { ItineraryPreviewRequest } from '@/api/routes';
import type { TripDraft } from '@/hooks/use-trip-draft';
import { toLocalDateTimeString } from '@/utils/dates';
import { buildPreviewRequest } from '@/utils/route-draft';

/**
 * The itinerary request for the current draft, or null until the route is
 * geocoded and a departure date is set.
 */
export function buildItineraryRequest(
  draft: TripDraft,
): ItineraryPreviewRequest | null {
  const route = buildPreviewRequest(draft);
  const { details, preferences } = draft;

  if (!route || !details.departureDate) {
    return null;
  }

  return {
    ...route,
    departure_at: toLocalDateTimeString(
      details.departureDate,
      details.departureTime,
    ),
    duration_days: details.durationDays,
    max_distance_per_day: preferences.limitDistance
      ? preferences.maxDistanceKm
      : null,
    max_driving_hours_per_day: preferences.limitDrivingHours
      ? preferences.maxDrivingHours
      : null,
  };
}

export function itineraryKey(request: ItineraryPreviewRequest) {
  return JSON.stringify(request);
}

/**
 * The saved itinerary preview if it still matches the draft, otherwise null.
 */
export function currentItinerary(draft: TripDraft) {
  const request = buildItineraryRequest(draft);
  const saved = draft.itinerary;

  if (!request || !saved || saved.key !== itineraryKey(request)) {
    return null;
  }

  return saved.data;
}
