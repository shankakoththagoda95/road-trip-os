import type { RouteFeesRequest } from '@/api/routes';
import type { TripDraft } from '@/hooks/use-trip-draft';
import { buildPreviewRequest } from '@/utils/route-draft';

/**
 * The road fees request for the current draft, or null until the route is
 * geocoded.
 */
export function buildFeesRequest(draft: TripDraft): RouteFeesRequest | null {
  const route = buildPreviewRequest(draft);

  if (!route) {
    return null;
  }

  return {
    ...route,
    vehicle_type: draft.vehicle?.vehicle_type ?? null,
  };
}

export function feesKey(request: RouteFeesRequest) {
  return JSON.stringify(request);
}

/**
 * The saved fees if they still match the draft, otherwise null.
 */
export function currentFees(draft: TripDraft) {
  const request = buildFeesRequest(draft);
  const saved = draft.fees;

  if (!request || !saved || saved.key !== feesKey(request)) {
    return null;
  }

  return saved.data;
}
