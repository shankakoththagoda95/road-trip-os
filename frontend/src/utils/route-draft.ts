import type { RoutePointInput, RoutePreviewRequest } from '@/api/routes';
import type {
  RoutePlace,
  TripDetailsDraft,
  TripDraft,
} from '@/hooks/use-trip-draft';
import { placeKey } from '@/utils/place-key';

/**
 * Start, stops in between, and destination (the last stop), as typed.
 * Empty stop fields are ignored.
 */
export function routeParts(details: TripDetailsDraft) {
  const stops = details.stops.map((stop) => stop.trim()).filter(Boolean);

  return {
    start: details.startLocation.trim(),
    via: stops.slice(0, -1),
    destination: stops.at(-1) ?? '',
    stops,
  };
}

export function placeFor(draft: TripDraft, text: string): RoutePlace | null {
  return draft.route.places[placeKey(text)] ?? null;
}

/**
 * The first typed location that still needs looking up, or null.
 */
export function nextPlaceToFind(draft: TripDraft) {
  const { start, stops } = routeParts(draft.details);

  return (
    [start, ...stops].find((text) => text && !placeFor(draft, text)) ?? null
  );
}

function toPointInput(place: RoutePlace, typed: string): RoutePointInput {
  return {
    location: typed,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

/**
 * The preview request for the current draft, or null while any location
 * still needs looking up.
 */
export function buildPreviewRequest(
  draft: TripDraft,
): RoutePreviewRequest | null {
  const { start, via, destination } = routeParts(draft.details);

  if (!start || !destination) {
    return null;
  }

  const startPlace = placeFor(draft, start);
  const destinationPlace = placeFor(draft, destination);
  const viaPlaces = via.map((text) => placeFor(draft, text));

  if (!startPlace || !destinationPlace || viaPlaces.some((place) => !place)) {
    return null;
  }

  return {
    start: toPointInput(startPlace, start),
    destination: toPointInput(destinationPlace, destination),
    stops: via.map((text, index) => toPointInput(viaPlaces[index]!, text)),
    trip_type: draft.details.tripType,
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
