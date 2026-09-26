import { vehicleRangeKm } from '@/constants/vehicles';
import type { BudgetDraft, TripDraft } from '@/hooks/use-trip-draft';
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

// Rough European averages in EUR, used by "Use typical prices". Parking is
// per day of the trip.
const TypicalPricesEur = {
  fuelPerLiter: 1.8,
  electricityPerKwh: 0.45,
  foodPerPersonPerDay: 35,
  parkingPerDay: 10,
};

// Approximate EUR exchange rates; only for the typical-price presets.
const EurRates: Record<Currency, number> = {
  EUR: 1,
  SEK: 11.5,
  NOK: 11.7,
  DKK: 7.46,
  GBP: 0.85,
  USD: 1.08,
};

/**
 * Typical prices for the fields that are still empty, in the chosen
 * currency. Filled-in fields are left alone.
 */
export function typicalPrices(draft: TripDraft): Partial<BudgetDraft> {
  const { budget, details } = draft;
  const rate = EurRates[budget.currency as Currency] ?? 1;
  const typical = TypicalPricesEur;

  const values: Partial<BudgetDraft> = {
    fuelPricePerLiter: (typical.fuelPerLiter * rate).toFixed(2),
    electricityPricePerKwh: (typical.electricityPerKwh * rate).toFixed(2),
    foodPerPersonPerDay: String(Math.round(typical.foodPerPersonPerDay * rate)),
    parkingCost: String(
      Math.round(typical.parkingPerDay * rate * details.durationDays),
    ),
  };

  return Object.fromEntries(
    Object.entries(values).filter(
      ([key]) => !budget[key as keyof BudgetDraft].trim(),
    ),
  );
}
