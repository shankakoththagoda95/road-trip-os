import type { FuelType, Vehicle, VehicleType } from '@/api/vehicles';

export const VehicleTypeOptions: readonly {
  value: VehicleType;
  label: string;
  emoji: string;
}[] = [
  { value: 'car', label: 'Car', emoji: '🚗' },
  { value: 'van', label: 'Van', emoji: '🚐' },
  { value: 'campervan', label: 'Campervan', emoji: '🚌' },
  { value: 'motorcycle', label: 'Motorcycle', emoji: '🏍️' },
];

export const FuelTypeOptions: readonly { value: FuelType; label: string }[] = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'plug_in_hybrid', label: 'Plug-in hybrid' },
  { value: 'electric', label: 'Electric' },
];

export function vehicleEmoji(type: string) {
  return VehicleTypeOptions.find((option) => option.value === type)?.emoji ?? '🚗';
}

export function fuelTypeLabel(type: string) {
  return FuelTypeOptions.find((option) => option.value === type)?.label ?? type;
}

// Fuel planning needs tank size + consumption; EV planning needs battery +
// energy use. Plug-in hybrids need both.
export function usesFuel(type: FuelType) {
  return type !== 'electric';
}

export function usesBattery(type: FuelType) {
  return type === 'electric' || type === 'plug_in_hybrid';
}

/**
 * Estimated range on a full tank / full battery, in km.
 */
export function vehicleRangeKm(vehicle: Vehicle) {
  const fuelKm =
    vehicle.tank_capacity && vehicle.fuel_consumption
      ? (vehicle.tank_capacity / vehicle.fuel_consumption) * 100
      : null;

  const electricKm =
    vehicle.battery_capacity && vehicle.energy_consumption
      ? (vehicle.battery_capacity / vehicle.energy_consumption) * 100
      : null;

  return { fuelKm, electricKm };
}
