import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Stepper } from '@/components/form/stepper';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type PreferencesDraft, useTripDraft } from '@/hooks/use-trip-draft';
import { pluralize } from '@/utils/dates';
import { currentRoutePreview } from '@/utils/route-draft';
import { formatDistance, formatDuration } from '@/utils/units';

export default function PreferencesStepScreen() {
  const router = useRouter();
  const { draft, updatePreferences, completeStep } = useTripDraft();
  const { preferences, details } = draft;
  const routePreview = currentRoutePreview(draft);

  function handleContinue() {
    completeStep('preferences');

    const { next } = getTripStep('preferences');
    router.navigate(next?.href ?? '/trips/new');
  }

  const drivingDays = routePreview
    ? estimateDrivingDays(
        routePreview.distance_meters,
        routePreview.duration_seconds,
        preferences,
      )
    : null;

  return (
    <WizardStepScreen stepId="preferences" onContinue={handleContinue}>
      <ThemedText type="small" themeColor="textSecondary">
        Limits are optional. They&apos;re used to split your route into
        driving days and to warn you about long days behind the wheel.
      </ThemedText>

      <LimitToggle
        title="Limit driving time per day"
        description="Maximum hours behind the wheel each day."
        enabled={preferences.limitDrivingHours}
        onToggle={(limitDrivingHours) =>
          updatePreferences({ limitDrivingHours })
        }>
        <Stepper
          label="Driving hours per day"
          value={preferences.maxDrivingHours}
          min={1}
          max={16}
          unit={(hours) => (hours === 1 ? 'hour' : 'hours')}
          onChange={(maxDrivingHours) => updatePreferences({ maxDrivingHours })}
        />
      </LimitToggle>

      <LimitToggle
        title="Limit distance per day"
        description="Maximum kilometres driven each day (10% tolerance)."
        enabled={preferences.limitDistance}
        onToggle={(limitDistance) => updatePreferences({ limitDistance })}>
        <Stepper
          label="Distance per day"
          value={preferences.maxDistanceKm}
          min={50}
          max={2000}
          step={50}
          unit={() => 'km'}
          onChange={(maxDistanceKm) => updatePreferences({ maxDistanceKm })}
        />
      </LimitToggle>

      {routePreview && drivingDays !== null && (
        <ThemedView type="backgroundSelected" style={styles.estimate}>
          <ThemedText type="smallBold">
            🛣️ {formatDistance(routePreview.distance_meters)} ·{' '}
            {formatDuration(routePreview.duration_seconds)} of driving
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {preferences.limitDrivingHours || preferences.limitDistance
              ? `With these limits that's at least ${pluralize(drivingDays, 'driving day', 'driving days')}.`
              : 'No daily limits: the route is planned as one continuous drive.'}
          </ThemedText>

          {drivingDays > details.durationDays && (
            <ThemedText type="small" themeColor="warning">
              ⚠️ Your trip is {pluralize(details.durationDays, 'day', 'days')}{' '}
              long, but the driving alone needs about{' '}
              {pluralize(drivingDays, 'day', 'days')}. Consider a longer trip
              or higher limits.
            </ThemedText>
          )}
        </ThemedView>
      )}

      {!routePreview && (
        <ThemedText type="small" themeColor="textSecondary">
          Plan your route first to see how many driving days you&apos;ll need.
        </ThemedText>
      )}
    </WizardStepScreen>
  );
}

/**
 * Rough lower bound on driving days. The backend splits days at stops, so
 * the real plan can need more.
 */
function estimateDrivingDays(
  distanceMeters: number,
  durationSeconds: number,
  preferences: PreferencesDraft,
) {
  const byTime = preferences.limitDrivingHours
    ? Math.ceil(durationSeconds / (preferences.maxDrivingHours * 3600))
    : 1;
  const byDistance = preferences.limitDistance
    ? Math.ceil(distanceMeters / (preferences.maxDistanceKm * 1000))
    : 1;

  return Math.max(byTime, byDistance, 1);
}

function LimitToggle({
  title,
  description,
  enabled,
  onToggle,
  children,
}: PropsWithChildren<{
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}>) {
  const colors = useTheme();

  return (
    <View style={[styles.toggle, { borderColor: colors.border }]}>
      <View style={styles.toggleHeader}>
        <View style={styles.toggleText}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        </View>

        <Switch
          accessibilityLabel={title}
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#FFFFFF"
        />
      </View>

      {enabled && children}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
  },

  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  toggleText: {
    flex: 1,
    gap: Spacing.half,
  },

  estimate: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },
});
