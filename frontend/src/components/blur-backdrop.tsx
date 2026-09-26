import { Animated, StyleSheet } from 'react-native';

/**
 * Native: dims only (no backdrop blur without expo-blur), fading with the
 * popup. The web version also blurs the page, see blur-backdrop.web.tsx.
 */
export function BlurBackdrop({
  progress,
}: {
  open: boolean;
  progress?: Animated.Value;
}) {
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: 'rgba(3, 10, 18, 0.6)', opacity: progress ?? 1 },
      ]}
    />
  );
}
