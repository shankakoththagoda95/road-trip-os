import { type Href, Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import { addTripDestination, createTrip } from '@/api/trips';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripSteps } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { fuelTypeLabel, vehicleEmoji } from '@/constants/vehicles';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import {
  formatDateTime,
  pluralize,
  toLocalDateTimeString,
} from '@/utils/dates';
import { currentRoutePreview } from '@/utils/route-draft';
import { formatDistance, formatDuration } from '@/utils/units';

// Steps that don't have their own section above.
const PlanningSteps = TripSteps.filter(
  (step) =>
    !['details', 'route', 'vehicle', 'preferences', 'summary'].includes(
      step.id,
    ),
);

export default function TripSummaryScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, completedSteps } = useTripDraft();
  const details = draft.details;

  const detailsComplete = completedSteps.has('details');
  const departureAt = toLocalDateTimeString(
    details.departureDate,
    details.departureTime,
  );

  const { vehicle, preferences } = draft;
  const stops = draft.route.stops;
  const routePreview = currentRoutePreview(draft);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Set if the trip was saved but a later request (e.g. a stop) failed,
  // so pressing the button again doesn't create a duplicate trip.
  const [tripSaved, setTripSaved] = useState(false);

  async function handleCreate() {
    if (tripSaved) {
      router.dismissTo('/trips');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    let tripId: number;

    try {
      const trip = await createTrip({
        name: details.name.trim(),
        start_location: details.startLocation.trim(),
        destination: details.destination.trim(),
        trip_type: details.tripType,
        departure_at: departureAt,
        travelers: details.travelers,
        duration_days: details.durationDays,
        vehicle_id: vehicle?.id ?? null,
        max_driving_hours_per_day: preferences.limitDrivingHours
          ? preferences.maxDrivingHours
          : null,
        max_distance_per_day: preferences.limitDistance
          ? preferences.maxDistanceKm
          : null,
      });
      tripId = trip.id;
    } catch (error) {
      const fieldMessage =
        error instanceof ApiError
          ? Object.values(error.fieldErrors)[0]
          : undefined;

      setSubmitError(fieldMessage ?? errorMessage(error));
      setSubmitting(false);
      return;
    }

    try {
      // Sequential so stops keep their order.
      for (const [index, stop] of stops.entries()) {
        await addTripDestination(tripId, {
          location: stop.location,
          stop_order: index + 1,
          latitude: stop.latitude,
          longitude: stop.longitude,
        });
      }
    } catch (error) {
      setTripSaved(true);
      setSubmitError(
        `Your trip was created, but some stops couldn't be saved: ${errorMessage(error)}`,
      );
      setSubmitting(false);
      return;
    }

    // Leave the wizard (its draft is discarded) and show the trip list.
    router.dismissTo('/trips');
  }

  return (
    <WizardStepScreen
      stepId="summary"
      onContinue={handleCreate}
      continueLabel={tripSaved ? 'View my trips' : '🚗 Create trip'}
      continueLoading={submitting}
      continueDisabled={!detailsComplete}>
      {detailsComplete ? (
        <>
          <SectionHeader title="Trip Details" editHref="/trips/new/details" />

          <View style={styles.rows}>
            <SummaryRow label="Name" value={details.name} />
            <SummaryRow
              label="Route"
              value={`${details.startLocation} ${
                details.tripType === 'round_trip' ? '⇄' : '→'
              } ${details.destination}`}
            />
            <SummaryRow
              label="Trip type"
              value={
                details.tripType === 'round_trip' ? 'Round trip' : 'One way'
              }
            />
            <SummaryRow label="Departure" value={formatDateTime(departureAt)} />
            <SummaryRow
              label="Duration"
              value={pluralize(details.durationDays, 'day', 'days')}
            />
            <SummaryRow
              label="Travelers"
              value={pluralize(details.travelers, 'person', 'people')}
            />
          </View>
        </>
      ) : (
        <View style={styles.notice}>
          <ThemedText type="smallBold">Trip Details are missing</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add a name, route and departure date before creating the trip.
          </ThemedText>
          <Link href="/trips/new/details">
            <ThemedText type="linkPrimary">Go to Trip Details →</ThemedText>
          </Link>
        </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader
        title="Route & Destinations"
        editHref="/trips/new/route"
      />

      <View style={styles.rows}>
        <SummaryRow
          label="Stops"
          value={
            stops.length > 0
              ? stops.map((stop) => stop.location).join(', ')
              : 'None'
          }
          muted={stops.length === 0}
        />
        <SummaryRow
          label="Distance"
          value={
            routePreview
              ? formatDistance(routePreview.distance_meters)
              : 'Not calculated yet'
          }
          muted={!routePreview}
        />
        <SummaryRow
          label="Driving time"
          value={
            routePreview
              ? formatDuration(routePreview.duration_seconds)
              : 'Not calculated yet'
          }
          muted={!routePreview}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader title="Vehicle" editHref="/trips/new/vehicle" />

      <SummaryRow
        label="Vehicle"
        value={
          vehicle
            ? `${vehicleEmoji(vehicle.vehicle_type)} ${vehicle.name} (${fuelTypeLabel(vehicle.fuel_type)})`
            : 'Not selected'
        }
        muted={!vehicle}
      />

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader
        title="Travel Preferences"
        editHref="/trips/new/preferences"
      />

      <View style={styles.rows}>
        <SummaryRow
          label="Driving per day"
          value={
            preferences.limitDrivingHours
              ? `Up to ${pluralize(preferences.maxDrivingHours, 'hour', 'hours')}`
              : 'No limit'
          }
          muted={!preferences.limitDrivingHours}
        />
        <SummaryRow
          label="Distance per day"
          value={
            preferences.limitDistance
              ? `Up to ${preferences.maxDistanceKm} km`
              : 'No limit'
          }
          muted={!preferences.limitDistance}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader title="Planning" />

      <View style={styles.rows}>
        {PlanningSteps.map((step) => (
          <SummaryRow
            key={step.id}
            label={`${step.emoji} ${step.title}`}
            value={completedSteps.has(step.id) ? 'Done' : 'Add later'}
            muted={!completedSteps.has(step.id)}
          />
        ))}
      </View>

      {submitError ? (
        <ThemedView
          type="backgroundSelected"
          accessibilityRole="alert"
          style={styles.error}>
          <ThemedText type="small" themeColor="danger">
            {submitError}
          </ThemedText>
        </ThemedView>
      ) : null}
    </WizardStepScreen>
  );
}

function SectionHeader({
  title,
  editHref,
}: {
  title: string;
  editHref?: Href;
}) {
  return (
    <View style={styles.sectionHeader}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>

      {editHref ? (
        <Link href={editHref}>
          <ThemedText type="linkPrimary">Edit</ThemedText>
        </Link>
      ) : null}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {label}
      </ThemedText>
      <ThemedText
        type="smallBold"
        themeColor={muted ? 'textSecondary' : 'text'}
        style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    fontSize: 18,
  },

  rows: {
    gap: Spacing.two,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  label: {
    flexShrink: 0,
  },

  value: {
    flex: 1,
    textAlign: 'right',
  },

  notice: {
    gap: Spacing.one,
  },

  divider: {
    height: 1,
  },

  error: {
    padding: Spacing.three,
    borderRadius: 12,
  },
});
