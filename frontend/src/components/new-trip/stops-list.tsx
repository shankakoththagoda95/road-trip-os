import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { TripType } from '@/api/trips';
import { inputStyle } from '@/components/form/form-field';
import { MarkerColors } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { placeKey } from '@/utils/place-key';
import { MaxStayNights } from '@/utils/stays';

// Enough for a long road trip; keeps routing requests reasonable.
export const MaxStops = 12;

/**
 * Ordered list of stop names. The last stop is where a one-way trip ends;
 * a round trip then drives back to the start.
 */
export function StopsList({
  stops,
  onChange,
  start,
  tripType,
  error,
  stayNights,
  onChangeStayNights,
}: {
  stops: string[];
  onChange: (stops: string[]) => void;
  start: string;
  tripType: TripType;
  error?: string;
  // Nights at each stop, keyed by placeKey; shown when given.
  stayNights?: Record<string, number>;
  onChangeStayNights?: (stayNights: Record<string, number>) => void;
}) {
  const colors = useTheme();
  const named = stops.map((stop) => stop.trim()).filter(Boolean);
  const last = named.at(-1);

  function update(index: number, value: string) {
    onChange(stops.map((stop, i) => (i === index ? value : stop)));
  }

  function move(index: number, offset: -1 | 1) {
    const next = [...stops];
    const [stop] = next.splice(index, 1);
    next.splice(index + offset, 0, stop);
    onChange(next);
  }

  function remove(index: number) {
    const next = stops.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : ['']);
  }

  return (
    <View style={styles.list}>
      {stops.map((stop, index) => {
        const isLast = index === stops.length - 1;

        return (
          <View key={index} style={styles.row}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    isLast && tripType === 'one_way'
                      ? MarkerColors.destination
                      : MarkerColors.stop,
                },
              ]}>
              <ThemedText style={styles.badgeText}>{index + 1}</ThemedText>
            </View>

            <TextInput
              accessibilityLabel={`Stop ${index + 1}`}
              placeholder={index === 0 ? 'e.g. Karlstad' : 'e.g. Oslo'}
              placeholderTextColor={colors.textSecondary}
              value={stop}
              onChangeText={(value) => update(index, value)}
              style={[
                inputStyle(colors, Boolean(error) && !stop.trim()),
                styles.input,
              ]}
            />

            {stayNights && onChangeStayNights && stop.trim() && (
              <NightsControl
                place={stop.trim()}
                nights={stayNights[placeKey(stop)] ?? 0}
                onChange={(nights) =>
                  onChangeStayNights({ ...stayNights, [placeKey(stop)]: nights })
                }
              />
            )}

            <StopButton
              icon="arrow-up"
              label={`Move stop ${index + 1} up`}
              onPress={index > 0 ? () => move(index, -1) : undefined}
            />
            <StopButton
              icon="arrow-down"
              label={`Move stop ${index + 1} down`}
              onPress={!isLast ? () => move(index, 1) : undefined}
            />
            <StopButton
              icon="close"
              label={`Remove stop ${index + 1}`}
              onPress={
                stops.length > 1 || stop.trim() ? () => remove(index) : undefined
              }
            />
          </View>
        );
      })}

      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}

      {stops.length < MaxStops && (
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange([...stops, ''])}
          style={({ hovered, pressed }) => [
            styles.addButton,
            { borderColor: colors.border },
            (hovered || pressed) && { backgroundColor: colors.backgroundSelected },
          ]}>
          <Ionicons name="add" size={18} color={colors.brand} />
          <ThemedText type="smallBold" style={{ color: colors.brand }}>
            Add stop
          </ThemedText>
        </Pressable>
      )}

      {last && (
        <ThemedText type="small" themeColor="textSecondary">
          {tripType === 'round_trip'
            ? `Round trip: ${start || 'Start'} → ${named.join(' → ')} → back to ${start || 'the start'}.`
            : `One way: ${start || 'Start'} → ${named.join(' → ')}. The trip ends in ${last}.`}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * Compact − / + for the nights at a stop.
 */
function NightsControl({
  place,
  nights,
  onChange,
}: {
  place: string;
  nights: number;
  onChange: (nights: number) => void;
}) {
  const colors = useTheme();

  return (
    <View
      style={[styles.nights, { borderColor: colors.border }]}
      accessible={false}>
      <StopButton
        icon="remove"
        label={`Fewer nights in ${place}`}
        onPress={nights > 0 ? () => onChange(nights - 1) : undefined}
      />
      <ThemedText
        type="smallBold"
        accessibilityLabel={`${nights} ${nights === 1 ? 'night' : 'nights'} in ${place}`}
        style={styles.nightsText}>
        🌙 {nights}
      </ThemedText>
      <StopButton
        icon="add"
        label={`More nights in ${place}`}
        onPress={nights < MaxStayNights ? () => onChange(nights + 1) : undefined}
      />
    </View>
  );
}

function StopButton({
  icon,
  label,
  onPress,
}: {
  icon: 'arrow-up' | 'arrow-down' | 'close' | 'add' | 'remove';
  label: string;
  onPress?: () => void;
}) {
  const colors = useTheme();
  const disabled = !onPress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }) => [
        styles.stopButton,
        { backgroundColor: hovered ? colors.backgroundSelected : 'transparent' },
        disabled && styles.disabled,
      ]}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nights: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
  },

  nightsText: {
    minWidth: 40,
    textAlign: 'center',
  },

  list: {
    gap: Spacing.two,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },

  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.one,
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  input: {
    flex: 1,
    minWidth: 0,
  },

  stopButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabled: {
    opacity: 0.3,
  },

  addButton: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
});
