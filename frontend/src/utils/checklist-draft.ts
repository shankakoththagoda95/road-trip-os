import type { ChecklistRequest } from '@/api/checklists';
import type { TripDraft } from '@/hooks/use-trip-draft';
import { currentFees } from '@/utils/fees-draft';

/**
 * The checklist request for the current draft, or null until the route's
 * countries are known (see Road Fees & Borders) and a date is set.
 */
export function buildChecklistRequest(
  draft: TripDraft,
): ChecklistRequest | null {
  const fees = currentFees(draft);
  const { details, vehicle } = draft;

  if (!fees || fees.countries.length === 0 || !details.departureDate) {
    return null;
  }

  return {
    country_codes: fees.countries.map((country) => country.code),
    departure_date: details.departureDate,
    duration_days: details.durationDays,
    vehicle_type: vehicle?.vehicle_type ?? null,
    fuel_type: vehicle?.fuel_type ?? null,
  };
}

export function checklistKey(request: ChecklistRequest) {
  return JSON.stringify(request);
}

/**
 * The saved checklist if it still matches the draft, otherwise null.
 */
export function currentChecklist(draft: TripDraft) {
  const request = buildChecklistRequest(draft);
  const saved = draft.checklist;

  if (!request || !saved || saved.key !== checklistKey(request)) {
    return null;
  }

  return saved.items;
}
