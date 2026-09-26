import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RouteLeg } from '@/api/routes';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate, pluralize } from '@/utils/dates';
import type { PlanDay, StayPlan } from '@/utils/stays';
import { formatDistance, formatDuration } from '@/utils/units';

// Days shown before "Show all".
const CollapsedDays = 8;

const NightColor = '#818CF8';

/**
 * Nights planned vs. the trip length, and which places the traveller is at
 * on each day.
 */
export function DayPlan({
  plan,
  legs,
  roundTrip,
  onSetDuration,
}: {
  plan: StayPlan;
  // The calculated route's legs, for distances (when available).
  legs?: RouteLeg[];
  roundTrip: boolean;
  onSetDuration: (days: number) => void;
}) {
  const colors = useTheme();
  const [expanded, setExpanded] = useState(false);

  const { plannedNights, tripNights, daysNeeded, spareNightsAt } = plan;
  const over = plannedNights > tripNights;
  const spare = tripNights - plannedNights;
  const shown = expanded ? plan.days : plan.days.slice(0, CollapsedDays);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${NightColor}2E` }]}>
          <MaterialCommunityIcons name="calendar-month-outline" size={20} color={NightColor} />
        </View>
        <View style={styles.headerText}>
          <ThemedText type="smallBold" style={styles.title}>
            Your days
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plannedNights} of {pluralize(tripNights, 'night', 'nights')} planned ·{' '}
            {tripNights + 1}-day trip
          </ThemedText>
        </View>
      </View>

      <View
        style={[styles.track, { backgroundColor: colors.border }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: Math.max(tripNights, plannedNights), now: plannedNights }}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.min(100, tripNights > 0 ? (plannedNights / tripNights) * 100 : 100)}%`,
              backgroundColor: over ? '#F59E0B' : NightColor,
            },
          ]}
        />
      </View>

      {over ? (
        <View style={[styles.notice, styles.warning]} accessibilityRole="alert">
          <MaterialCommunityIcons name="alert" size={20} color="#F59E0B" />
          <ThemedText type="small" style={styles.noticeText}>
            Your stays need {pluralize(daysNeeded, 'day', 'days')}, but the trip is{' '}
            {pluralize(tripNights + 1, 'day', 'days')}.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSetDuration(daysNeeded)}
            style={({ hovered }) => [
              styles.noticeButton,
              { borderColor: '#F59E0B' },
              hovered && { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
            ]}>
            <ThemedText type="smallBold" style={styles.warningText}>
              Make it {daysNeeded} days
            </ThemedText>
          </Pressable>
        </View>
      ) : spare > 0 ? (
        <View style={[styles.notice, { backgroundColor: colors.backgroundSelected }]}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
            {plannedNights === 0
              ? `Use the nights on each stop to plan where you sleep. For now, the free ${pluralize(spare, 'night is', 'nights are')} spent in ${spareNightsAt}.`
              : `${pluralize(spare, 'more night', 'more nights')} will be spent in ${spareNightsAt}${roundTrip ? ' before driving home' : ''}.`}
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.notice, styles.done]}>
          <MaterialCommunityIcons name="check-circle" size={20} color="#22C55E" />
          <ThemedText type="small" style={[styles.noticeText, styles.doneText]}>
            Every night of the trip is planned.
          </ThemedText>
        </View>
      )}

      <View style={[styles.days, { borderColor: colors.border }]}>
        {shown.map((day, index) => (
          <DayRow
            key={day.dayNumber}
            day={day}
            legs={legs}
            first={index === 0}
            overTrip={day.dayNumber > tripNights + 1}
          />
        ))}
      </View>

      {plan.days.length > CollapsedDays && (
        <Pressable accessibilityRole="button" onPress={() => setExpanded((value) => !value)}>
          <ThemedText type="linkPrimary">
            {expanded ? 'Show fewer days' : `Show all ${plan.days.length} days`}
          </ThemedText>
        </Pressable>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Daily driving limits (Travel Preferences) may split long drives; the
        Itinerary Review shows the final plan.
      </ThemedText>
    </View>
  );
}

function DayRow({
  day,
  legs,
  first,
  overTrip,
}: {
  day: PlanDay;
  legs?: RouteLeg[];
  first: boolean;
  overTrip: boolean;
}) {
  const colors = useTheme();
  const driving = day.kind === 'drive';
  const dayLegs = legs && day.legs.every((index) => legs[index]) ? day.legs.map((index) => legs[index]) : null;
  const distance = dayLegs?.reduce((sum, leg) => sum + leg.distance_meters, 0);
  const duration = dayLegs?.reduce((sum, leg) => sum + leg.duration_seconds, 0);

  return (
    <View
      style={[
        styles.day,
        !first && { borderTopWidth: 1, borderTopColor: colors.border },
        overTrip && styles.overTrip,
      ]}>
      <View style={styles.dayLabel}>
        <ThemedText type="smallBold">Day {day.dayNumber}</ThemedText>
        {day.date && (
          <ThemedText type="small" themeColor="textSecondary">
            {formatShortDate(day.date)}
          </ThemedText>
        )}
      </View>

      <View
        style={[
          styles.dayIcon,
          { backgroundColor: driving ? 'rgba(37, 99, 235, 0.14)' : `${NightColor}24` },
        ]}>
        <MaterialCommunityIcons
          name={driving ? 'car' : 'map-marker-radius'}
          size={18}
          color={driving ? '#3B82F6' : NightColor}
        />
      </View>

      <View style={styles.dayText}>
        <ThemedText type="smallBold">
          {driving ? `${day.from} → ${day.to}` : `Day in ${day.to}`}
        </ThemedText>
        {driving && (day.through.length > 0 || distance !== undefined) && (
          <ThemedText type="small" themeColor="textSecondary">
            {[
              day.through.length > 0 ? `via ${day.through.join(', ')}` : null,
              distance !== undefined && duration !== undefined
                ? `${formatDistance(distance)} · ${formatDuration(duration)}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </ThemedText>
        )}
      </View>

      <View style={styles.overnight}>
        <MaterialCommunityIcons
          name={day.overnight ? 'weather-night' : 'flag-checkered'}
          size={16}
          color={day.overnight ? NightColor : colors.textSecondary}
        />
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {day.overnight ?? 'Trip ends'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: 17,
  },

  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },

  fill: {
    height: '100%',
    borderRadius: 4,
  },

  notice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    padding: Spacing.three,
  },

  noticeText: {
    flex: 1,
    minWidth: 200,
  },

  warning: {
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.6)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },

  warningText: {
    color: '#F59E0B',
  },

  noticeButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },

  done: {
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.5)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },

  doneText: {
    color: '#22C55E',
  },

  days: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },

  day: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },

  overTrip: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },

  dayLabel: {
    width: 88,
  },

  dayIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayText: {
    flex: 1,
    minWidth: 180,
  },

  overnight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    maxWidth: 200,
  },
});
