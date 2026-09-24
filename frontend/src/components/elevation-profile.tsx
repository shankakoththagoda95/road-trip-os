import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ElevationProfilePoint } from '@/api/routes';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ChartHeight = 120;
const YAxisWidth = 52;

/**
 * Elevation along the route as thin bars from a 0 m baseline.
 * Hover (web) or press (native) a bar to read its value.
 */
export function ElevationProfile({
  points,
}: {
  points: ElevationProfilePoint[];
}) {
  const colors = useTheme();
  const [active, setActive] = useState<number | null>(null);

  if (points.length === 0) {
    return null;
  }

  const elevations = points.map((point) => point.elevation_m);
  const highest = Math.max(...elevations);
  const lowest = Math.min(...elevations);
  // Bars start at 0 m so heights stay comparable; below sea level clamps to 0.
  const scaleMax = Math.max(highest, 1);
  const totalKm = points[points.length - 1].distance_km;
  const activePoint = active !== null ? points[active] : null;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`Elevation profile: lowest ${Math.round(lowest)} metres, highest ${Math.round(highest)} metres over ${Math.round(totalKm)} kilometres.`}>
      <View style={styles.header}>
        <ThemedText type="smallBold">Elevation profile</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {activePoint
            ? `km ${Math.round(activePoint.distance_km)} · ${Math.round(activePoint.elevation_m)} m`
            : 'Hover a bar for details'}
        </ThemedText>
      </View>

      <View style={styles.plotRow}>
        <View style={styles.yAxis}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.axisText}>
            {Math.round(highest)} m
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.axisText}>
            0 m
          </ThemedText>
        </View>

        <View
          style={[styles.plot, { borderBottomColor: colors.border }]}
          onPointerLeave={() => setActive(null)}>
          {points.map((point, index) => {
            const height = Math.max(
              1,
              (Math.max(point.elevation_m, 0) / scaleMax) * ChartHeight,
            );

            return (
              <Pressable
                key={index}
                accessible={false}
                onHoverIn={() => setActive(index)}
                onPressIn={() => setActive(index)}
                style={styles.hitArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      height,
                      backgroundColor: colors.primary,
                      opacity: active === null || active === index ? 1 : 0.45,
                    },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.xAxis}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.axisText}>
          0 km
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.axisText}>
          {Math.round(totalKm)} km
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },

  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: Spacing.three,
  },

  plotRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  yAxis: {
    width: YAxisWidth,
    height: ChartHeight,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  plot: {
    flex: 1,
    height: ChartHeight,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },

  // Full-height column so thin bars are easy to hover.
  hitArea: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 0.5,
  },

  bar: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    // Line up with the plot, not the y-axis labels.
    marginLeft: YAxisWidth + Spacing.two,
  },

  axisText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
