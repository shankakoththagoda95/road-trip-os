import { StyleSheet, View } from 'react-native';

/**
 * Native: a solid fill in the first colour (no CSS gradients). The web
 * version is a real gradient, see gradient-fill.web.tsx.
 */
export function GradientFill({
  from,
}: {
  from: string;
  to: string;
  angle?: number;
}) {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: from }]} />;
}
