import { type Href, Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import {
  addTripDestination,
  createTrip,
  createTripBudget,
  createTripEv,
  createTripFuel,
  createItinerary,
} from '@/api/trips';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fuelTypeLabel, vehicleEmoji } from '@/constants/vehicles';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import {
  formatDateTime,
  pluralize,
  toLocalDateTimeString,
} from '@/utils/dates';
import { estimateBudget } from '@/utils/budget';
import { currentConditions } from '@/utils/conditions-draft';
import { currentEnergyPlan, energyMode } from '@/utils/energy-draft';
import { currentChecklist } from '@/utils/checklist-draft';
import { currentFees } from '@/utils/fees-draft';
import { currentItinerary } from '@/utils/itinerary-draft';
import { formatMoney } from '@/utils/numbers';
import { currentRoutePreview } from '@/utils/route-draft';
import { formatDistance, formatDuration } from '@/utils/units';

export default function TripSummaryScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, completedSteps, forgetSavedDraft, reset } = useTripDraft();
  const details = draft.details;

  const detailsComplete = completedSteps.has('details');
  const departureAt = toLocalDateTimeString(
    details.departureDate,
    details.departureTime,
  );

  const { vehicle, preferences } = draft;
  const stops = draft.route.stops;
  const routePreview = currentRoutePreview(draft);
  const budget = estimateBudget(draft);
  const energyPlan = currentEnergyPlan(draft);
  const conditions = currentConditions(draft);
  const fees = currentFees(draft);
  const checklist = currentChecklist(draft);
  const itinerary = currentItinerary(draft);
  // Only a plan that fits the daily limits can be saved.
  const saveItinerary = itinerary !== null && itinerary.days.length > 0;
  const requiredItems = (checklist ?? []).filter((item) => item.required);
  const requiredReady = requiredItems.filter((item) =>
    draft.checkedItems.includes(item.id),
  ).length;
  const { energy } = draft;
  // Only save a starting level the user actually reviewed.
  const saveEnergy = vehicle !== null && completedSteps.has('energy');
  const money = (amount: number) => formatMoney(amount, draft.budget.currency);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Set if the trip was saved but a later request (e.g. a stop) failed,
  // so pressing the button again doesn't create a duplicate trip.
  const [tripSaved, setTripSaved] = useState(false);

  async function handleCreate() {
    if (tripSaved) {
      reset();
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
      forgetSavedDraft();
    } catch (error) {
      const fieldMessage =
        error instanceof ApiError
          ? Object.values(error.fieldErrors)[0]
          : undefined;

      setSubmitError(fieldMessage ?? errorMessage(error));
      setSubmitting(false);
      return;
    }

    let savingPart = 'stops';

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

      if (saveItinerary) {
        savingPart = 'itinerary';

        await createItinerary(tripId);
      }

      if (budget.total > 0) {
        savingPart = 'budget';

        await createTripBudget(tripId, {
          currency: draft.budget.currency,
          estimated_fuel_cost: budget.fuelCost,
          estimated_ev_charging_cost: budget.evChargingCost,
          estimated_toll_cost: budget.tollCost,
          estimated_food_cost: budget.foodCost,
          estimated_parking_cost: budget.parkingCost,
          estimated_other_cost: budget.otherCost,
        });
      }

      if (saveEnergy && vehicle) {
        savingPart = 'starting fuel / battery level';

        if (energyMode(vehicle) === 'ev') {
          await createTripEv(tripId, energy.startLevelPercent);
        } else if (vehicle.tank_capacity) {
          await createTripFuel(
            tripId,
            (vehicle.tank_capacity * energy.startLevelPercent) / 100,
          );
        }
      }
    } catch (error) {
      setTripSaved(true);
      setSubmitError(
        `Your trip was created, but the ${savingPart} couldn't be saved: ${errorMessage(error)}`,
      );
      setSubmitting(false);
      return;
    }

    // Leave the wizard with a fresh draft for next time.
    reset();
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

      <SectionHeader title="Trip Budget" editHref="/trips/new/budget" />

      {budget.total > 0 ? (
        <View style={styles.rows}>
          {(
            [
              ['Fuel', budget.fuelCost],
              ['Charging', budget.evChargingCost],
              ['Food', budget.foodCost],
              ['Tolls', budget.tollCost],
              ['Parking', budget.parkingCost],
              ['Other', budget.otherCost],
            ] as const
          )
            .filter(([, value]) => value > 0)
            .map(([label, value]) => (
              <SummaryRow key={label} label={label} value={money(value)} />
            ))}
          <SummaryRow label="Estimated total" value={money(budget.total)} />
        </View>
      ) : (
        <SummaryRow label="Budget" value="Not set" muted />
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader title="Fuel / EV Planning" editHref="/trips/new/energy" />

      {vehicle && saveEnergy ? (
        <View style={styles.rows}>
          <SummaryRow
            label={
              energyMode(vehicle) === 'ev'
                ? 'Battery when leaving'
                : 'Tank when leaving'
            }
            value={`${energy.startLevelPercent}%`}
          />
          <SummaryRow
            label={
              energyMode(vehicle) === 'ev' ? 'Charging stops' : 'Fuel stops'
            }
            value={
              energyPlan
                ? energyPlan.stops.length === 0
                  ? 'None needed'
                  : energyPlan.stops
                      .map((stop) => stop.station?.name ?? '?')
                      .join(', ')
                : 'Not planned yet'
            }
            muted={!energyPlan}
          />
        </View>
      ) : (
        <SummaryRow label="Fuel / EV" value="Not planned" muted />
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader
        title="Weather & Conditions"
        editHref="/trips/new/conditions"
      />

      {conditions ? (
        <View style={styles.rows}>
          <SummaryRow
            label="Warnings"
            value={
              conditions.warnings.length > 0
                ? conditions.warnings.join('; ')
                : 'None'
            }
          />
          {conditions.terrain && (
            <SummaryRow
              label="Highest point"
              value={`${Math.round(conditions.terrain.max_elevation_m)} m`}
            />
          )}
        </View>
      ) : (
        <SummaryRow label="Conditions" value="Not checked yet" muted />
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader title="Road Fees & Borders" editHref="/trips/new/fees" />

      {fees ? (
        <View style={styles.rows}>
          <SummaryRow
            label="Countries"
            value={fees.countries.map((country) => country.name).join(' → ')}
          />
          <SummaryRow
            label="Road fees"
            value={
              fees.total_eur > 0
                ? `≈ ${formatMoney(fees.total_eur, 'EUR')}`
                : 'None expected'
            }
          />
        </View>
      ) : (
        <SummaryRow label="Road fees" value="Not checked yet" muted />
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader title="Travel Checklist" editHref="/trips/new/checklist" />

      {checklist ? (
        <SummaryRow
          label="Required items ready"
          value={`${requiredReady} of ${requiredItems.length}`}
          muted={requiredReady < requiredItems.length}
        />
      ) : (
        <SummaryRow label="Checklist" value="Not generated yet" muted />
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <SectionHeader title="Itinerary" editHref="/trips/new/itinerary" />

      {itinerary ? (
        saveItinerary ? (
          <View style={styles.rows}>
            {itinerary.days
              .filter((day) => day.driving)
              .map((day) => (
                <SummaryRow
                  key={day.day_number}
                  label={`Day ${day.day_number}`}
                  value={`${day.from_location} → ${day.to_location} (${formatDistance(day.distance_meters)})`}
                />
              ))}
          </View>
        ) : (
          <SummaryRow
            label="Itinerary"
            value="Doesn't fit your daily limits"
            muted
          />
        )
      ) : (
        <SummaryRow label="Itinerary" value="Not reviewed yet" muted />
      )}

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
