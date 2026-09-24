import { apiRequest } from '@/api/client';

export type VehicleType = 'car' | 'motorcycle' | 'campervan' | 'van';

export type FuelType =
  | 'petrol'
  | 'diesel'
  | 'hybrid'
  | 'plug_in_hybrid'
  | 'electric';

export type VehicleCreate = {
  name: string;
  vehicle_type: VehicleType;
  fuel_type: FuelType;
  // Litres per 100 km.
  fuel_consumption: number | null;
  // Litres.
  tank_capacity: number | null;
  // kWh.
  battery_capacity: number | null;
  // kWh per 100 km.
  energy_consumption: number | null;
};

export type Vehicle = VehicleCreate & {
  id: number;
  user_id: number;
};

export function listVehicles() {
  return apiRequest<Vehicle[]>('/vehicles/');
}

export function createVehicle(data: VehicleCreate) {
  return apiRequest<Vehicle>('/vehicles/', { method: 'POST', body: data });
}
