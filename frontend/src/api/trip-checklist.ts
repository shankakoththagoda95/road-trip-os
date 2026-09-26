import type { ChecklistCategory } from '@/api/checklists';
import { apiRequest } from '@/api/client';

export type TripChecklistItem = {
  id: number;
  trip_id: number;
  name: string;
  description: string | null;
  // Generated items only.
  category: ChecklistCategory | null;
  required: boolean;
  // Added by the traveller rather than generated for the route.
  personal: boolean;
  checked: boolean;
  position: number;
};

export type TripChecklistItemCreate = {
  name: string;
  description?: string | null;
  category?: ChecklistCategory | null;
  required?: boolean;
  personal?: boolean;
};

const base = (tripId: number) => `/trips/${tripId}/checklist/`;

/**
 * Generated requirements first, then personal items.
 */
export function getTripChecklist(tripId: number) {
  return apiRequest<TripChecklistItem[]>(base(tripId));
}

export function addTripChecklistItem(tripId: number, item: TripChecklistItemCreate) {
  return apiRequest<TripChecklistItem>(base(tripId), { method: 'POST', body: item });
}

export function addTripChecklistItems(
  tripId: number,
  items: TripChecklistItemCreate[],
) {
  return apiRequest<TripChecklistItem[]>(`${base(tripId)}bulk`, {
    method: 'POST',
    body: { items },
  });
}

export function updateTripChecklistItem(
  tripId: number,
  itemId: number,
  changes: { checked?: boolean; name?: string },
) {
  return apiRequest<TripChecklistItem>(`${base(tripId)}${itemId}`, {
    method: 'PATCH',
    body: changes,
  });
}

export function deleteTripChecklistItem(tripId: number, itemId: number) {
  return apiRequest<void>(`${base(tripId)}${itemId}`, { method: 'DELETE' });
}
