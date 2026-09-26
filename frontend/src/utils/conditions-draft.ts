import type { RouteConditionsRequest } from '@/api/routes';
import type { TripDraft } from '@/hooks/use-trip-draft';
import { toLocalDateTimeString } from '@/utils/dates';
import { buildPreviewRequest } from '@/utils/route-draft';
import { withStayNights } from '@/utils/stays';

/**
 * The weather & terrain request for the current draft, or null until the
 * route is geocoded and a departure date is set.
 */
export function buildConditionsRequest(
  draft: TripDraft,
): RouteConditionsRequest | null {
  const route = buildPreviewRequest(draft);
  const { details, preferences } = draft;

  if (!route || !details.departureDate) {
    return null;
  }

  return {
    // Stays decide which day each place is reached.
    ...withStayNights(route, details),
    departure_at: toLocalDateTimeString(
      details.departureDate,
      details.departureTime,
    ),
    max_driving_hours_per_day: preferences.limitDrivingHours
      ? preferences.maxDrivingHours
      : null,
  };
}

export function conditionsKey(request: RouteConditionsRequest) {
  return JSON.stringify(request);
}

/**
 * The saved conditions if they still match the draft, otherwise null.
 */
export function currentConditions(draft: TripDraft) {
  const request = buildConditionsRequest(draft);
  const saved = draft.conditions;

  if (!request || !saved || saved.key !== conditionsKey(request)) {
    return null;
  }

  return saved.data;
}
