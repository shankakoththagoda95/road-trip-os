import { Image } from 'react-native';

import { vehicleTypeIcon } from '@/constants/vehicles';

/**
 * Illustration for a vehicle type (car, van, campervan, motorcycle).
 */
export function VehicleIcon({ type, size = 40 }: { type: string; size?: number }) {
  return (
    <Image
      source={vehicleTypeIcon(type)}
      resizeMode="contain"
      style={{ width: size, height: size }}
      accessibilityIgnoresInvertColors
    />
  );
}
