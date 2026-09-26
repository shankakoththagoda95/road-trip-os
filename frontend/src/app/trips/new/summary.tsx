import { type Href, Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import { addTripChecklistItems } from '@/api/trip-checklist';
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
import { fuelTypeLabel } from '@/constants/vehicles';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import {
  formatDateTime,
  pluralize,
  toLocalDateTimeString,
} from '@/utils/dates';
import { estimateBudget } from '@/utils/budget';
import { currentConditions } from '@/utils/conditions-draft';
import { validateDetails } from '@/utils/details-validation';
import { currentEnergyPlan, energyMode } from '@/utils/energy-draft';
import { currentChecklist } from '@/utils/checklist-draft';
import { currentFees } from '@/utils/fees-draft';
import { currentItinerary } from '@/utils/itinerary-draft';
import { formatMoney } from '@/utils/numbers';
import {
  currentRoutePreview,
  placeFor,
  routeParts,
} from '@/utils/route-draft';
import { nightsAt } from '@/utils/stays';
import { formatDistance, formatDuration } from '@/utils/units';

export default function TripSummaryScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, completedSteps, forgetSavedDraft, reset } = useTripDraft();
  const details = draft.details;

  // Checked on the details themselves, so it doesn't matter how the user
  // got here (Next, the step bar, or a restored draft).
  const detailProblems = Object.values(validateDetails(details));
  const detailsComplete = detailProblems.length === 0;
  const departureAt = toLocalDateTimeString(
    details.departureDate,
    details.departureTime,
  );

  const { vehicle, preferences } = draft;
  // The last stop is the trip's destination; the others are saved as stops
  // in between (with coordinates when the Route step has looked them up).
  const { start, via, destination, stops } = routeParts(details);
  const routeLine = [
    start,
    ...stops,
    ...(details.tripType === 'round_trip' ? [start] : []),
  ].join(' → ');
  const routePreview = currentRoutePreview(draft);
  const budget = estimateBudget(draft);
  const energyPlan = currentEnergyPlan(draft);
  const conditions = currentConditions(draft);
  const fees = currentFees(draft);
  const checklist = currentChecklist(draft);
  const itinerary = currentItinerary(draft);
  // Only a plan that fits the daily limits can be saved.
  const saveItinerary = itinerary !== null && itinerary.days.length > 0;
  const requiredCount = (checklist ?? []).filter((item) => item.required).length;
  const { personalChecklist } = draft;
  // e.g. "Hallstatt (2 nights)".
  const stays = stops
    .filter((text) => nightsAt(details, text) > 0)
    .map((text) => `${text} (${pluralize(nightsAt(details, text), 'night', 'nights')})`);
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
        start_location: start,
        destination,
        trip_type: details.tripType,
        departure_at: departureAt,
        travelers: details.travelers,
        duration_days: details.durationDays,
        destination_nights: nightsAt(details, destination),
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
      for (const [index, text] of via.entries()) {
        const place = placeFor(draft, text);

        // Without coordinates the backend looks the place up itself.
        await addTripDestination(tripId, {
          location: text,
          stop_order: index + 1,
          latitude: place?.latitude ?? null,
          longitude: place?.longitude ?? null,
          nights: nightsAt(details, text),
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

      // Saved with the trip so it can be ticked off while travelling.
      const checklistItems = [
        ...(checklist ?? []).map((item) => ({
          name: item.name,
          description: item.description,
          category: item.category,
          required: item.required,
          personal: false,
        })),
        ...personalChecklist.map((name) => ({ name, personal: true })),
      ];

      if (checklistItems.length > 0) {
        savingPart = 'checklist';

        await addTripChecklistItems(tripId, checklistItems);
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
      continueDisabled={!detailsComplete}
      summary={
        detailsComplete ? undefined : (
          <ThemedText type="small" themeColor="danger">
            Can&apos;t create the trip yet: fix{' '}
            {detailProblems.length === 1
              ? 'one thing'
              : `${detailProblems.length} things`}{' '}
            in Trip Details (listed at the top).
          </ThemedText>
        )
      }>
      {detailsComplete ? (
        <>
          <SectionHeader title="Trip Details" editHref="/trips/new/details" />

          <View style={styles.rows}>
            <SummaryRow label="Name" value={details.name} />
            <SummaryRow label="Route" value={routeLine} />
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
        <View style={styles.notice} accessibilityRole="alert">
          <ThemedText type="smallBold">
            Finish Trip Details to create your trip
          </ThemedText>
          {detailProblems.map((problem) => (
            <ThemedText key={problem} type="small" themeColor="danger">
              • {problem}
            </ThemedText>
          ))}
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
        <SummaryRow label="Stops" value={stops.join(', ')} />
        <SummaryRow
          label="Stays"
          value={stays.length > 0 ? stays.join(', ') : 'No nights planned'}
          muted={stays.length === 0}
        />
        <SummaryRow
          label={details.tripType === 'round_trip' ? 'Finish' : 'Final stop'}
          value={details.tripType === 'round_trip' ? `Back in ${start}` : destination}
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
            ? `${vehicle.name} (${fuelTypeLabel(vehicle.fuel_type)})`
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
          label="Checklist"
          value={`${requiredCount} required, ${checklist.length - requiredCount} recommended`}
        />
      ) : (
        <SummaryRow label="Checklist" value="Not generated yet" muted />
      )}
      <SummaryRow
        label="Personal items"
        value={
          personalChecklist.length > 0 ? String(personalChecklist.length) : 'None added'
        }
        muted={personalChecklist.length === 0}
      />

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
