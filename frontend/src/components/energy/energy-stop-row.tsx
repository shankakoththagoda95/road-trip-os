import { StyleSheet, View } from 'react-native';

import type { EnergyStop } from '@/api/routes';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One planned fuel / charging stop: where, how full the tank or battery
 * is expected to be, and how far the station is from the route.
 */
export function EnergyStopRow({
  stop,
  number,
  color,
  ev,
}: {
  stop: EnergyStop;
  number: number;
  color: string;
  ev: boolean;
}) {
  const colors = useTheme();
  const { station } = stop;

  const facts = [
    `At km ${Math.round(stop.distance_from_start_km)}`,
    stop.level_percent != null
      ? `${ev ? 'battery' : 'tank'} at ${Math.round(stop.level_percent)}%`
      : null,
    stop.search_radius_km != null && stop.distance_from_route_km != null
      ? `${stop.distance_from_route_km.toFixed(1)} km off route (within ${stop.search_radius_km} km)`
      : null,
  ].filter(Boolean);

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={[styles.badge, { backgroundColor: station ? color : colors.warning }]}>
        <ThemedText style={styles.badgeText}>{number}</ThemedText>
      </View>

      <View style={styles.text}>
        <ThemedText type="smallBold">
          {station?.name ?? 'No station found nearby'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {facts.join(' · ')}
        </ThemedText>
        {station && station.details.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {station.details.join(' · ')}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },

  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
