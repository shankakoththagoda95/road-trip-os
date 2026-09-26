import type { ImageSourcePropType } from 'react-native';

import type { FuelType, Vehicle, VehicleType } from '@/api/vehicles';

// Illustrations per vehicle type (assets/images/{car,van,camper-van,motorcycle}.png).
export const VehicleTypeIcons: Record<VehicleType, ImageSourcePropType> = {
  car: require('@/assets/images/brand/vehicle-types/car.png'),
  van: require('@/assets/images/brand/vehicle-types/van.png'),
  campervan: require('@/assets/images/brand/vehicle-types/campervan.png'),
  motorcycle: require('@/assets/images/brand/vehicle-types/motorcycle.png'),
};

export const VehicleTypeOptions: readonly {
  value: VehicleType;
  label: string;
  image: ImageSourcePropType;
}[] = [
  { value: 'car', label: 'Car', image: VehicleTypeIcons.car },
  { value: 'van', label: 'Van', image: VehicleTypeIcons.van },
  { value: 'campervan', label: 'Campervan', image: VehicleTypeIcons.campervan },
  { value: 'motorcycle', label: 'Motorcycle', image: VehicleTypeIcons.motorcycle },
];

export const FuelTypeOptions: readonly { value: FuelType; label: string }[] = [
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'plug_in_hybrid', label: 'Plug-in hybrid' },
  { value: 'electric', label: 'Electric' },
];

// e.g. "Volvo XC90", or null when neither is set.
export function vehicleMakeModel(vehicle: {
  brand?: string | null;
  model?: string | null;
}) {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || null;
}

export function vehicleTypeIcon(type: string) {
  return VehicleTypeIcons[type as VehicleType] ?? VehicleTypeIcons.car;
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
