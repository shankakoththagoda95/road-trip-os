import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import { describeWeather } from '@/utils/weather';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// WMO weather codes → icon and colour.
const Icons: [codes: number[], icon: IconName, color: string][] = [
  [[0], 'weather-sunny', '#FACC15'],
  [[1, 2], 'weather-partly-cloudy', '#FBBF24'],
  [[3], 'weather-cloudy', '#94A3B8'],
  [[45, 48], 'weather-fog', '#94A3B8'],
  [[51, 53, 55, 80, 81], 'weather-partly-rainy', '#60A5FA'],
  [[56, 57, 66, 67], 'weather-snowy-rainy', '#7DD3FC'],
  [[61, 63], 'weather-rainy', '#60A5FA'],
  [[65, 82], 'weather-pouring', '#3B82F6'],
  [[71, 73, 75, 77], 'snowflake', '#7DD3FC'],
  [[85, 86], 'weather-snowy-heavy', '#7DD3FC'],
  [[95, 96, 99], 'weather-lightning-rainy', '#A78BFA'],
];

/**
 * Coloured icon for a WMO weather code, labelled for screen readers.
 */
export function WeatherIcon({ code, size = 40 }: { code: number; size?: number }) {
  const match = Icons.find(([codes]) => codes.includes(code));

  return (
    <MaterialCommunityIcons
      name={match?.[1] ?? 'thermometer'}
      size={size}
      color={match?.[2] ?? '#94A3B8'}
      accessibilityLabel={describeWeather(code).label}
    />
  );
}
