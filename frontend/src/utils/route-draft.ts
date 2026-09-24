import type { RoutePointInput, RoutePreviewRequest } from '@/api/routes';
import type { RoutePlace, TripDraft } from '@/hooks/use-trip-draft';

/**
 * A geocoded place is only valid while it still matches the text the user
 * entered (they may have edited Trip Details since).
 */
export function placeMatches(place: RoutePlace | null, text: string) {
  return place !== null && place.location === text.trim();
}

function toPointInput(place: RoutePlace): RoutePointInput {
  return {
    location: place.location,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

/**
 * The preview request for the current draft, or null while the start or
 * destination still needs geocoding.
 */
export function buildPreviewRequest(
  draft: TripDraft,
): RoutePreviewRequest | null {
  const { details, route } = draft;

  if (
    !placeMatches(route.start, details.startLocation) ||
    !placeMatches(route.destination, details.destination)
  ) {
    return null;
  }

  return {
    start: toPointInput(route.start!),
    destination: toPointInput(route.destination!),
    stops: route.stops.map(toPointInput),
    trip_type: details.tripType,
  };
}

export function previewKey(request: RoutePreviewRequest) {
  return JSON.stringify(request);
}

/**
 * The saved route preview if it still matches the draft, otherwise null.
 */
export function currentRoutePreview(draft: TripDraft) {
  const request = buildPreviewRequest(draft);
  const preview = draft.route.preview;

  if (!request || !preview || preview.key !== previewKey(request)) {
    return null;
  }

  return preview.data;
}
