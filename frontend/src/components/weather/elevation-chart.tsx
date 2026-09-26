import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import type { ElevationProfilePoint } from '@/api/routes';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Space around the plot for axis labels and the callouts above peaks.
const Padding = { top: 64, right: 16, bottom: 28, left: 64 };

const LowColor = '#22C55E';

// Callout box size (see styles.callout).
const CalloutWidth = 112;
const CalloutHeight = 46;
const EndColor = '#38BDF8';

/**
 * Elevation along the route as a filled area, marking the lowest point,
 * highest point and the end. Hover (web) or drag to read any point.
 */
export function ElevationChart({
  points,
  height = 280,
}: {
  points: ElevationProfilePoint[];
  height?: number;
}) {
  const colors = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  if (points.length < 2) {
    return null;
  }

  const elevations = points.map((point) => point.elevation_m);
  const highest = Math.max(...elevations);
  const lowest = Math.min(...elevations);
  const highIndex = elevations.indexOf(highest);
  const lowIndex = elevations.indexOf(lowest);
  const endIndex = points.length - 1;
  const totalKm = points[endIndex].distance_km;

  const yStep = niceStep(Math.max(highest, 1), 4);
  const yMax = Math.ceil(Math.max(highest, 1) / yStep) * yStep;
  const yMin = Math.min(0, Math.floor(lowest / yStep) * yStep);
  const xStep = niceStep(Math.max(totalKm, 1), 5);

  const plotWidth = Math.max(0, width - Padding.left - Padding.right);
  const plotHeight = height - Padding.top - Padding.bottom;

  const x = (km: number) => Padding.left + (km / Math.max(totalKm, 1)) * plotWidth;
  const y = (metres: number) =>
    Padding.top + (1 - (metres - yMin) / (yMax - yMin)) * plotHeight;

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.distance_km).toFixed(1)},${y(point.elevation_m).toFixed(1)}`)
    .join(' ');
  const baseline = y(yMin);
  const area = `${line} L${x(totalKm).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;

  const yTicks = range(yMin, yMax, yStep);
  // Round steps, plus the exact total at the end (unless it would overlap).
  const xTicks = range(0, totalKm, xStep).filter(
    (km) => totalKm - km > xStep * 0.4,
  );

  function handlePointer(offsetX: number) {
    if (plotWidth <= 0) return;
    const km = ((offsetX - Padding.left) / plotWidth) * totalKm;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(point.distance_km - km) < Math.abs(points[nearest].distance_km - km)) {
        nearest = index;
      }
    });
    setActive(nearest);
  }

  const activePoint = active !== null ? points[active] : null;

  return (
    <View
      style={[styles.container, { height }]}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={`Elevation profile over ${Math.round(totalKm)} kilometres: lowest point ${Math.round(lowest)} metres, highest ${Math.round(highest)} metres, ending at ${Math.round(elevations[endIndex])} metres.`}>
      {width > 0 && (
        <>
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={0.55} />
                <Stop offset="1" stopColor={colors.primary} stopOpacity={0.04} />
              </LinearGradient>
            </Defs>

            {yTicks.map((metres) => (
              <Line
                key={metres}
                x1={Padding.left}
                x2={width - Padding.right}
                y1={y(metres)}
                y2={y(metres)}
                stroke={colors.border}
                strokeDasharray={metres === yMin ? undefined : '4 6'}
              />
            ))}

            <Path d={area} fill="url(#elevationFill)" />
            <Path d={line} fill="none" stroke={colors.primary} strokeWidth={2} />

            {activePoint && (
              <Line
                x1={x(activePoint.distance_km)}
                x2={x(activePoint.distance_km)}
                y1={Padding.top}
                y2={baseline}
                stroke={colors.textSecondary}
                strokeDasharray="3 4"
              />
            )}

            <Marker cx={x(points[lowIndex].distance_km)} cy={y(lowest)} color={LowColor} />
            <Marker cx={x(points[highIndex].distance_km)} cy={y(highest)} color={colors.primary} />
            <Marker cx={x(totalKm)} cy={y(elevations[endIndex])} color={EndColor} />
            {activePoint && (
              <Circle
                cx={x(activePoint.distance_km)}
                cy={y(activePoint.elevation_m)}
                r={4}
                fill={colors.text}
              />
            )}
          </Svg>

          {yTicks.map((metres) => (
            <ThemedText
              key={metres}
              type="small"
              themeColor="textSecondary"
              style={[styles.yLabel, { top: y(metres) - 9, width: Padding.left - 10 }]}>
              {formatMetres(metres)}
            </ThemedText>
          ))}

          {[...xTicks, totalKm].map((km) => (
            <ThemedText
              key={km}
              type="small"
              themeColor="textSecondary"
              style={[
                styles.xLabel,
                { top: height - Padding.bottom + 6, left: x(km) - 40 },
              ]}>
              {Math.round(km).toLocaleString()} km
            </ThemedText>
          ))}

          {placeCallouts(
            [
              { index: highIndex, label: 'Highest point' },
              { index: lowIndex, label: 'Lowest point' },
              { index: endIndex, label: 'End point' },
            ],
            (index) => ({
              px: x(points[index].distance_km),
              py: y(points[index].elevation_m),
            }),
            width,
            height,
          ).map((callout) => (
            <Callout
              key={callout.label}
              title={formatMetres(points[callout.index].elevation_m)}
              label={callout.label}
              left={callout.left}
              top={callout.top}
            />
          ))}

          {activePoint && (
            <View
              pointerEvents="none"
              style={[
                styles.readout,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}>
              <ThemedText type="smallBold">
                {formatMetres(activePoint.elevation_m)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                at km {Math.round(activePoint.distance_km).toLocaleString()}
              </ThemedText>
            </View>
          )}

          {/* Catches the pointer over the plot for the hover read-out. */}
          <View
            style={[
              styles.hitArea,
              {
                left: Padding.left,
                width: plotWidth,
                top: Padding.top,
                height: plotHeight,
              },
            ]}
            onPointerMove={(event) =>
              handlePointer(
                Padding.left +
                  ((event.nativeEvent as unknown as { offsetX?: number }).offsetX ??
                    0),
              )
            }
            onPointerLeave={() => setActive(null)}
            onStartShouldSetResponder={() => true}
            onResponderMove={(event) =>
              handlePointer(Padding.left + event.nativeEvent.locationX)
            }
            onResponderRelease={() => setActive(null)}
          />
        </>
      )}
    </View>
  );
}

function Marker({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return <Circle cx={cx} cy={cy} r={6} fill={color} stroke="#FFFFFF" strokeWidth={2} />;
}

type Box = { left: number; top: number };

/**
 * Positions for the point labels, in priority order. Each sits above its
 * point; if that overlaps a label already placed it moves above that label,
 * then below its point, and is left out if nothing fits. Labels for the
 * same point are shown once.
 */
function placeCallouts(
  wanted: { index: number; label: string }[],
  position: (index: number) => { px: number; py: number },
  width: number,
  height: number,
) {
  const placed: (Box & { index: number; label: string })[] = [];
  const overlaps = (box: Box) =>
    placed.some(
      (other) =>
        box.left < other.left + CalloutWidth + 4 &&
        other.left < box.left + CalloutWidth + 4 &&
        box.top < other.top + CalloutHeight + 4 &&
        other.top < box.top + CalloutHeight + 4,
    );

  for (const { index, label } of wanted) {
    if (placed.some((other) => other.index === index)) continue;

    const { px, py } = position(index);
    const left = Math.min(
      Math.max(px - CalloutWidth / 2, Padding.left),
      width - CalloutWidth - 4,
    );
    const above = py - CalloutHeight - 14;
    const blocker = placed.find((other) => overlaps({ left, top: above }));
    const candidates = [
      above,
      ...(blocker ? [blocker.top - CalloutHeight - 6] : []),
      py + 14,
    ].filter((top) => top >= 0 && top + CalloutHeight <= height - Padding.bottom);

    const top = candidates.find((candidate) => !overlaps({ left, top: candidate }));
    if (top !== undefined) {
      placed.push({ index, label, left, top });
    }
  }

  return placed;
}

/**
 * Label box for a point on the chart.
 */
function Callout({
  title,
  label,
  left,
  top,
}: {
  title: string;
  label: string;
  left: number;
  top: number;
}) {
  const colors = useTheme();

  return (
    <View
      pointerEvents="none"
      style={[
        styles.callout,
        {
          left,
          top,
          width: CalloutWidth,
          height: CalloutHeight,
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.calloutLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

// A round step (1, 2, 2.5 or 5 × 10ⁿ) giving about `count` intervals.
function niceStep(max: number, count: number) {
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));

  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * magnitude >= rough) {
      return factor * magnitude;
    }
  }

  return 10 * magnitude;
}

function range(from: number, to: number, step: number) {
  const values: number[] = [];
  for (let value = from; value <= to + 1e-9; value += step) {
    values.push(Math.round(value * 100) / 100);
  }
  return values;
}

function formatMetres(metres: number) {
  return `${Math.round(metres).toLocaleString()} m`;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  yLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },

  xLabel: {
    position: 'absolute',
    width: 80,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  callout: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    alignItems: 'center',
  },

  calloutLabel: {
    fontSize: 12,
    lineHeight: 16,
  },

  // Top left: the point labels favour the peaks and the end on the right.
  readout: {
    position: 'absolute',
    left: Padding.left,
    top: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },

  hitArea: {
    position: 'absolute',
  },
});
