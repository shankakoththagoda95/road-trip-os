import { vehicleRangeKm } from '@/constants/vehicles';
import type { TripDraft } from '@/hooks/use-trip-draft';
import { parseNumber } from '@/utils/numbers';
import { currentRoutePreview } from '@/utils/route-draft';

export const CurrencyOptions = [
  { value: 'EUR', label: 'EUR €' },
  { value: 'SEK', label: 'SEK kr' },
  { value: 'NOK', label: 'NOK kr' },
  { value: 'DKK', label: 'DKK kr' },
  { value: 'GBP', label: 'GBP £' },
  { value: 'USD', label: 'USD $' },
] as const;

export type Currency = (typeof CurrencyOptions)[number]['value'];

export type EnergyEstimate = {
  // Litres of fuel / kWh of electricity for the whole route.
  amount: number;
  // Price per litre / kWh entered by the user, null until entered.
  unitPrice: number | null;
  cost: number;
};

export type BudgetEstimate = {
  // Calculated from route × vehicle when possible, otherwise null
  // (the typed-in amount is used instead).
  fuel: EnergyEstimate | null;
  electricity: EnergyEstimate | null;
  fuelCost: number;
  evChargingCost: number;
  tollCost: number;
  foodCost: number;
  parkingCost: number;
  otherCost: number;
  total: number;
};

const amount = (text: string) => Math.max(0, parseNumber(text) ?? 0);

/**
 * Estimated trip costs from the draft. Fuel and charging are calculated from
 * the route distance and the vehicle's consumption when both are known.
 * Plug-in hybrids are assumed to use their full electric range first.
 */
export function estimateBudget(draft: TripDraft): BudgetEstimate {
  const { budget, vehicle, details } = draft;
  const route = currentRoutePreview(draft);
  const routeKm = route ? route.distance_meters / 1000 : null;

  let electricKm = 0;
  let fuelKm = routeKm ?? 0;

  if (vehicle && routeKm !== null) {
    const { electricKm: electricRange } = vehicleRangeKm(vehicle);

    if (vehicle.fuel_type === 'electric') {
      electricKm = routeKm;
      fuelKm = 0;
    } else if (vehicle.fuel_type === 'plug_in_hybrid' && electricRange) {
      electricKm = Math.min(routeKm, electricRange);
      fuelKm = routeKm - electricKm;
    }
  }

  const fuel =
    vehicle?.fuel_consumption && routeKm !== null
      ? energyEstimate(
          (fuelKm / 100) * vehicle.fuel_consumption,
          budget.fuelPricePerLiter,
        )
      : null;

  const electricity =
    vehicle?.energy_consumption && routeKm !== null
      ? energyEstimate(
          (electricKm / 100) * vehicle.energy_consumption,
          budget.electricityPricePerKwh,
        )
      : null;

  const fuelCost = fuel ? fuel.cost : amount(budget.fuelCost);
  const evChargingCost = electricity
    ? electricity.cost
    : amount(budget.evChargingCost);
  const tollCost = amount(budget.tollCost);
  const foodCost =
    amount(budget.foodPerPersonPerDay) *
    details.travelers *
    details.durationDays;
  const parkingCost = amount(budget.parkingCost);
  const otherCost = amount(budget.otherCost);

  return {
    fuel,
    electricity,
    fuelCost,
    evChargingCost,
    tollCost,
    foodCost,
    parkingCost,
    otherCost,
    total:
      fuelCost +
      evChargingCost +
      tollCost +
      foodCost +
      parkingCost +
      otherCost,
  };
}

function energyEstimate(amountNeeded: number, priceText: string) {
  const unitPrice = parseNumber(priceText);

  return {
    amount: amountNeeded,
    unitPrice,
    cost: unitPrice !== null ? amountNeeded * Math.max(0, unitPrice) : 0,
  };
}
