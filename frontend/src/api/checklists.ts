import { apiRequest } from '@/api/client';
import type { FuelType, VehicleType } from '@/api/vehicles';

export type ChecklistCategory =
  | 'documents'
  | 'payments'
  | 'equipment'
  | 'winter'
  | 'rules'
  | 'vehicle';

export type ChecklistItem = {
  // Stable id, used to remember ticked items.
  id: string;
  category: ChecklistCategory;
  name: string;
  description: string;
  required: boolean;
  country_codes: string[];
};

export type ChecklistRequest = {
  // ISO alpha-2 codes in route order.
  country_codes: string[];
  // `YYYY-MM-DD`.
  departure_date: string;
  duration_days: number;
  vehicle_type: VehicleType | null;
  fuel_type: FuelType | null;
};

export function generateChecklist(request: ChecklistRequest) {
  return apiRequest<{ items: ChecklistItem[] }>('/checklists/', {
    method: 'POST',
    body: request,
  });
}
