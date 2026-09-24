import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { type ItineraryDay, previewItinerary } from '@/api/routes';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import { formatShortDate, pluralize } from '@/utils/dates';
import {
  buildItineraryRequest,
  currentItinerary,
  itineraryKey,
} from '@/utils/itinerary-draft';
import { formatDistance, formatDuration } from '@/utils/units';

export default function ItineraryStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, setItinerary, completeStep } = useTripDraft();

  const request = buildItineraryRequest(draft);
  const requestKey = request ? itineraryKey(request) : null;
  const itinerary = currentItinerary(draft);
  const hasItinerary = itinerary !== null;

  // Retrying bumps this so the effect runs again.
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(
    null,
  );
  const failureKey = `${requestKey}:${attempt}`;
  const error = failure?.key === failureKey ? failure.message : null;

  useEffect(() => {
    if (!requestKey || hasItinerary) {
      return;
    }

    let cancelled = false;

    previewItinerary(JSON.parse(requestKey))
      .then((data) => {
        if (!cancelled) {
          setItinerary({ key: requestKey, data });
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setFailure({ key: failureKey, message: errorMessage(fetchError) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, hasItinerary, failureKey, setItinerary]);

  function handleContinue() {
    completeStep('itinerary');

    const { next } = getTripStep('itinerary');
    router.navigate(next?.href ?? '/trips/new');
  }

  if (!request) {
    return (
      <WizardStepScreen stepId="itinerary" onContinue={handleContinue}>
        <ThemedText type="smallBold">Plan your route first</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your day-by-day plan is built from your route, dates and daily
          driving limits.
        </ThemedText>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/trips/new/route')}>
          <ThemedText type="linkPrimary">Go to Route & Destinations →</ThemedText>
        </Pressable>
      </WizardStepScreen>
    );
  }

  const freeDays = itinerary
    ? itinerary.days.filter((day) => !day.driving).length
    : 0;
  const hasLongLegs = itinerary !== null && itinerary.days.length === 0;

  return (
    <WizardStepScreen stepId="itinerary" onContinue={handleContinue}>
      {!itinerary && !error && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Building your day-by-day plan…
          </ThemedText>
        </View>
      )}

      {error && (
        <ThemedView
          type="backgroundSelected"
          accessibilityRole="alert"
          style={styles.box}>
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((value) => value + 1)}>
            <ThemedText type="linkPrimary">Try again</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {itinerary && (
        <>
          {itinerary.problems.length > 0 && (
            <ThemedView
              type="backgroundSelected"
              accessibilityRole="alert"
              style={styles.box}>
              <ThemedText type="smallBold" themeColor="warning">
                ⚠️ {hasLongLegs ? "This plan doesn't fit your limits" : 'Heads up'}
              </ThemedText>
              {itinerary.problems.map((problem) => (
                <ThemedText key={problem} type="small">
                  • {problem}
                </ThemedText>
              ))}
              <View style={styles.links}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.navigate('/trips/new/route')}>
                  <ThemedText type="linkPrimary">Add stops</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.navigate('/trips/new/preferences')}>
                  <ThemedText type="linkPrimary">Change limits</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.navigate('/trips/new/details')}>
                  <ThemedText type="linkPrimary">Change trip length</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          )}

          {!hasLongLegs && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {pluralize(itinerary.driving_days, 'driving day', 'driving days')}
                {freeDays > 0 && ` · ${pluralize(freeDays, 'free day', 'free days')}`}{' '}
                · {formatDistance(itinerary.distance_meters)} ·{' '}
                {formatDuration(itinerary.duration_seconds)} behind the wheel
              </ThemedText>

              <View style={styles.timeline}>
                {itinerary.days.map((day, index) => (
                  <DayCard
                    key={day.day_number}
                    day={day}
                    isLast={index === itinerary.days.length - 1}
                  />
                ))}
              </View>
            </>
          )}
        </>
      )}
    </WizardStepScreen>
  );
}

function DayCard({ day, isLast }: { day: ItineraryDay; isLast: boolean }) {
  const colors = useTheme();
  const date = new Date(`${day.date}T00:00`);
  const overLimit =
    day.distance_status === 'exceeds_limit' ||
    day.driving_time_status === 'exceeds_limit';
  const nearLimit = day.distance_status === 'within_tolerance';

  return (
    <View style={styles.dayRow}>
      <View style={styles.rail}>
        <View
          style={[
            styles.railDot,
            {
              backgroundColor: day.driving ? colors.primary : colors.card,
              borderColor: colors.primary,
            },
          ]}
        />
        {!isLast && (
          <View style={[styles.railLine, { backgroundColor: colors.border }]} />
        )}
      </View>

      <View style={styles.dayContent}>
        <ThemedText type="small" themeColor="textSecondary">
          Day {day.day_number} · {formatShortDate(date)}
        </ThemedText>

        {day.driving ? (
          <>
            <ThemedText type="smallBold" style={styles.dayTitle}>
              🚗 {day.from_location} → {day.to_location}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDistance(day.distance_meters)} ·{' '}
              {formatDuration(day.duration_seconds)}
            </ThemedText>

            {day.legs.length > 1 &&
              day.legs.map((leg, index) => (
                <ThemedText
                  key={index}
                  type="small"
                  themeColor="textSecondary"
                  style={styles.leg}>
                  • {leg.from_location} → {leg.to_location} (
                  {formatDistance(leg.distance_meters)},{' '}
                  {formatDuration(leg.duration_seconds)})
                </ThemedText>
              ))}

            {overLimit && (
              <ThemedText type="small" themeColor="danger">
                Over your daily limit
              </ThemedText>
            )}
            {!overLimit && nearLimit && (
              <ThemedText type="small" themeColor="warning">
                Slightly over your distance limit (within 10%)
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText type="smallBold" style={styles.dayTitle}>
            🏖️ Free day in {day.to_location}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  box: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },

  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    marginTop: Spacing.one,
  },

  timeline: {
    gap: 0,
  },

  dayRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },

  rail: {
    width: 16,
    alignItems: 'center',
  },

  railDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    marginTop: 4,
  },

  railLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
  },

  dayContent: {
    flex: 1,
    gap: Spacing.half,
    paddingBottom: Spacing.four,
  },

  dayTitle: {
    fontSize: 16,
  },

  leg: {
    paddingLeft: Spacing.two,
  },
});
