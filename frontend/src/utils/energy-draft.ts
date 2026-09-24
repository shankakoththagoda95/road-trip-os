import type { EnergyStopsRequest } from '@/api/routes';
import type { Vehicle } from '@/api/vehicles';
import type { TripDraft } from '@/hooks/use-trip-draft';
import { buildPreviewRequest } from '@/utils/route-draft';

// Electric vehicles plan charging stops; everything else plans fuel stops.
export function energyMode(vehicle: Vehicle): 'fuel' | 'ev' {
  return vehicle.fuel_type === 'electric' ? 'ev' : 'fuel';
}

/**
 * The stop-planning request for the current draft, or null without a
 * vehicle or a geocoded route.
 */
export function buildEnergyRequest(
  draft: TripDraft,
): EnergyStopsRequest | null {
  const route = buildPreviewRequest(draft);
  const { vehicle, energy } = draft;

  if (!route || !vehicle) {
    return null;
  }

  return {
    ...route,
    vehicle_id: vehicle.id,
    start_level_percent: energy.startLevelPercent,
    reserve_percent: energy.reservePercent,
    refill_to_percent:
      energyMode(vehicle) === 'ev' ? energy.chargeToPercent : 100,
  };
}

export function energyKey(request: EnergyStopsRequest) {
  return JSON.stringify(request);
}

/**
 * The saved stop plan if it still matches the draft, otherwise null.
 */
export function currentEnergyPlan(draft: TripDraft) {
  const request = buildEnergyRequest(draft);
  const plan = draft.energy.plan;

  if (!request || !plan || plan.key !== energyKey(request)) {
    return null;
  }

  return plan.data;
}
