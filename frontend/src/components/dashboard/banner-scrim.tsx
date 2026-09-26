import { StyleSheet, View } from 'react-native';

export type ScrimStops = readonly (readonly [number, number])[];

/**
 * Native: a flat tint (no CSS gradients). The web version fades from the
 * left, see banner-scrim.web.tsx.
 */
export function BannerScrim({
  color,
}: {
  color: string;
  stops?: ScrimStops;
}) {
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${color}, 0.7)` }]}
    />
  );
}
