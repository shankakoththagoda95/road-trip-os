import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import type { RouteMapProps } from './types';

/**
 * Native placeholder. The web version (route-map.web.tsx) renders a
 * Leaflet map.
 * TODO: native map (react-native-maps) in the mobile pass.
 */
export function RouteMap({ height = 320 }: RouteMapProps) {
  return (
    <ThemedView
      type="backgroundSelected"
      style={[styles.placeholder, { height }]}>
      <ThemedText style={styles.emoji}>🗺️</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        The route map is available in the web app for now.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },

  emoji: {
    fontSize: 36,
    lineHeight: 44,
  },
});
