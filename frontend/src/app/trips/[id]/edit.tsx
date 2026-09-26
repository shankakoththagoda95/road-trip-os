import { useLocalSearchParams, useRouter } from 'expo-router';
import { type PropsWithChildren, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import {
  addTripDestination,
  createItinerary,
  createTripBudget,
  deleteTripDestination,
  getTrip,
  getTripBudget,
  listTripDestinations,
  type Trip,
  type TripBudget,
  type TripDestination,
  type TripType,
  updateTrip,
  updateTripBudget,
} from '@/api/trips';
import { listVehicles, type Vehicle } from '@/api/vehicles';
import { ChipSelect } from '@/components/form/chip-select';
import { DateInput } from '@/components/form/date-input';
import { FormField, TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { SegmentedControl } from '@/components/form/segmented-control';
import { Stepper } from '@/components/form/stepper';
import { StopsList } from '@/components/new-trip/stops-list';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { vehicleTypeIcon } from '@/constants/vehicles';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { CurrencyOptions, type Currency } from '@/utils/budget';
import { toLocalDateTimeString } from '@/utils/dates';
import { parseNumber } from '@/utils/numbers';
import { placeKey } from '@/utils/place-key';

type EditData = {
  trip: Trip;
  stops: TripDestination[];
  vehicles: Vehicle[];
  budget: TripBudget | null;
};

async function loadEditData(tripId: number): Promise<EditData> {
  const [trip, stops, vehicles, budget] = await Promise.all([
    getTrip(tripId),
    listTripDestinations(tripId),
    listVehicles(),
    getTripBudget(tripId).catch((error) => {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }),
  ]);

  return {
    trip,
    stops: [...stops].sort((a, b) => a.stop_order - b.stop_order),
    vehicles,
    budget,
  };
}

export default function EditTripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const colors = useTheme();
  const [state, reload] = useAsync(() => loadEditData(tripId), [tripId]);

  return (
    <Screen maxWidth={800}>
      {state.status === 'loading' && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Loading trip…
          </ThemedText>
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.loading}>
          <ThemedText themeColor="danger">{state.message}</ThemedText>
          <ThemedText type="linkPrimary" onPress={reload}>
            Try again
          </ThemedText>
        </View>
      )}

      {state.status === 'success' && <EditTripForm data={state.data} />}
    </Screen>
  );
}

// --- Form ---

const TripTypeOptions: readonly { value: TripType; label: string }[] = [
  { value: 'one_way', label: 'One way' },
  { value: 'round_trip', label: 'Round trip' },
];

const BudgetFields = [
  ['estimated_fuel_cost', '⛽ Fuel'],
  ['estimated_ev_charging_cost', '⚡ Charging'],
  ['estimated_food_cost', '🍽️ Food'],
  ['estimated_toll_cost', '🛣️ Tolls'],
  ['estimated_parking_cost', '🅿️ Parking'],
  ['estimated_other_cost', '➕ Other'],
] as const;

type BudgetField = (typeof BudgetFields)[number][0];

function EditTripForm({ data }: { data: EditData }) {
  const router = useRouter();
  const { trip } = data;

  // Local date & time from the saved wall-clock departure.
  const [departureDate, departureTime] = trip.departure_at.split('T');

  const [name, setName] = useState(trip.name);
  const [tripType, setTripType] = useState<TripType>(trip.trip_type);
  const [startLocation, setStartLocation] = useState(trip.start_location);
  // Stops in order; the last one is the trip's destination.
  const [stops, setStops] = useState<string[]>([
    ...data.stops.map((stop) => stop.location),
    trip.destination,
  ]);
  // Nights per stop (keyed by placeKey), including the destination.
  const [stayNights, setStayNights] = useState<Record<string, number>>(() => ({
    ...Object.fromEntries(
      data.stops.map((stop) => [placeKey(stop.location), stop.nights ?? 0]),
    ),
    [placeKey(trip.destination)]: trip.destination_nights ?? 0,
  }));
  const [date, setDate] = useState(departureDate);
  const [time, setTime] = useState(departureTime.slice(0, 5));
  const [durationDays, setDurationDays] = useState(trip.duration_days);
  const [travelers, setTravelers] = useState(trip.travelers);
  const [vehicleId, setVehicleId] = useState<number | null>(trip.vehicle_id);

  const [limitHours, setLimitHours] = useState(
    trip.max_driving_hours_per_day !== null,
  );
  const [maxHours, setMaxHours] = useState(trip.max_driving_hours_per_day ?? 8);
  const [limitDistance, setLimitDistance] = useState(
    trip.max_distance_per_day !== null,
  );
  const [maxKm, setMaxKm] = useState(trip.max_distance_per_day ?? 500);

  // Coordinates already saved for stops, reused when they are saved again.
  const knownPlaces = new Map(
    data.stops.map((stop) => [placeKey(stop.location), stop]),
  );
  const namedStops = stops.map((stop) => stop.trim()).filter(Boolean);

  const [currency, setCurrency] = useState(data.budget?.currency ?? 'EUR');
  const [amounts, setAmounts] = useState<Record<BudgetField, string>>(
    () =>
      Object.fromEntries(
        BudgetFields.map(([field]) => {
          const value = data.budget?.[field] ?? 0;
          return [field, value ? String(value) : ''];
        }),
      ) as Record<BudgetField, string>,
  );

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function validate() {
    const next: Record<string, string> = {};

    if (!name.trim()) next.name = 'Give your trip a name.';
    if (!startLocation.trim()) next.start_location = 'Where does the trip start?';
    if (namedStops.length === 0) next.stops = 'Add at least one stop.';

    const departure = new Date(toLocalDateTimeString(date, time));

    if (Number.isNaN(departure.getTime())) {
      next.departure_at = 'Pick a valid date and time.';
    } else if (departure.getTime() <= Date.now()) {
      next.departure_at = 'Departure must be in the future.';
    }

    return next;
  }

  async function handleSave() {
    const validationErrors = validate();
    setErrors(validationErrors);
    setSaveError(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSaving(true);

    // 1. Trip details.
    try {
      await updateTrip(trip.id, {
        name: name.trim(),
        start_location: startLocation.trim(),
        destination: namedStops[namedStops.length - 1],
        destination_nights:
          stayNights[placeKey(namedStops[namedStops.length - 1])] ?? 0,
        trip_type: tripType,
        departure_at: toLocalDateTimeString(date, time),
        travelers,
        duration_days: durationDays,
        vehicle_id: vehicleId,
        max_driving_hours_per_day: limitHours ? maxHours : null,
        max_distance_per_day: limitDistance ? maxKm : null,
      });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
      } else {
        setSaveError(errorMessage(error));
      }
      setSaving(false);
      return;
    }

    // 2. Stops, 3. budget. The trip itself is already saved at this point.
    let part = 'stops';

    try {
      // Replace the stops in between (all but the last) in their new order.
      for (const stop of data.stops) {
        await deleteTripDestination(trip.id, stop.id);
      }

      for (const [index, text] of namedStops.slice(0, -1).entries()) {
        const known = knownPlaces.get(placeKey(text));

        // Without coordinates the backend looks the place up itself.
        await addTripDestination(trip.id, {
          location: text,
          stop_order: index + 1,
          latitude: known?.latitude ?? null,
          longitude: known?.longitude ?? null,
          nights: stayNights[placeKey(text)] ?? 0,
        });
      }

      part = 'budget';
      const estimates = Object.fromEntries(
        BudgetFields.map(([field]) => [
          field,
          Math.max(0, parseNumber(amounts[field]) ?? 0),
        ]),
      ) as Record<BudgetField, number>;
      const total = Object.values(estimates).reduce((sum, value) => sum + value, 0);

      if (data.budget) {
        await updateTripBudget(trip.id, {
          ...data.budget,
          currency,
          ...estimates,
        });
      } else if (total > 0) {
        await createTripBudget(trip.id, { currency, ...estimates });
      }
    } catch (error) {
      setSaveError(
        `Trip details were saved, but the ${part} couldn't be: ${errorMessage(error)}`,
      );
      setSaving(false);
      return;
    }

    // 4. Refresh the saved itinerary (used for the calendar). It fails when
    // a leg is longer than a daily limit; the trip page explains that.
    await createItinerary(trip.id).catch(() => undefined);

    router.back();
  }

  const vehicleOptions = [
    { value: 'none', label: 'No vehicle' },
    ...data.vehicles.map((vehicle) => ({
      value: String(vehicle.id),
      label: vehicle.name,
      image: vehicleTypeIcon(vehicle.vehicle_type),
    })),
  ];

  return (
    <>
      <ThemedText type="linkPrimary" onPress={() => router.back()}>
        ← Back to trip
      </ThemedText>

      <ThemedText type="title" style={styles.title}>
        Edit trip
      </ThemedText>

      <Card title="📝 Trip details">
        <TextField
          label="Trip name"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />

        <FormField label="Trip type">
          <SegmentedControl
            options={TripTypeOptions}
            value={tripType}
            onChange={setTripType}
          />
        </FormField>

        <TextField
          label="Starting point"
          value={startLocation}
          onChangeText={setStartLocation}
          error={errors.start_location}
        />

        <View style={styles.row}>
          <View style={styles.column}>
            <FormField label="Departure date" error={errors.departure_at}>
              <DateInput
                mode="date"
                accessibilityLabel="Departure date"
                value={date}
                onChange={setDate}
                hasError={Boolean(errors.departure_at)}
              />
            </FormField>
          </View>
          <View style={styles.column}>
            <FormField label="Departure time">
              <DateInput
                mode="time"
                accessibilityLabel="Departure time"
                value={time}
                onChange={setTime}
              />
            </FormField>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.column}>
            <FormField label="Duration">
              <Stepper
                label="Duration"
                value={durationDays}
                min={1}
                max={365}
                unit={(days) => (days === 1 ? 'day' : 'days')}
                onChange={setDurationDays}
              />
            </FormField>
          </View>
          <View style={styles.column}>
            <FormField label="Travelers">
              <Stepper
                label="Travelers"
                value={travelers}
                min={1}
                max={50}
                unit={(count) => (count === 1 ? 'person' : 'people')}
                onChange={setTravelers}
              />
            </FormField>
          </View>
        </View>
      </Card>

      <Card title="🗺️ Stops">
        <ThemedText type="small" themeColor="textSecondary">
          {tripType === 'round_trip'
            ? 'The places you visit, in order. The trip then returns to the starting point.'
            : 'The places you visit, in order. The last one is your destination.'}
        </ThemedText>
        <StopsList
          stops={stops}
          onChange={setStops}
          start={startLocation.trim()}
          tripType={tripType}
          error={errors.stops}
          stayNights={stayNights}
          onChangeStayNights={setStayNights}
        />
      </Card>

      <Card title="🚙 Vehicle">
        <ChipSelect
          options={vehicleOptions}
          value={vehicleId === null ? 'none' : String(vehicleId)}
          onChange={(value) => setVehicleId(value === 'none' ? null : Number(value))}
        />
      </Card>

      <Card title="⚙️ Daily limits">
        <LimitRow
          label="Limit driving time per day"
          enabled={limitHours}
          onToggle={setLimitHours}>
          <Stepper
            label="Driving hours per day"
            value={maxHours}
            min={1}
            max={16}
            unit={(hours) => (hours === 1 ? 'hour' : 'hours')}
            onChange={setMaxHours}
          />
        </LimitRow>
        <LimitRow
          label="Limit distance per day"
          enabled={limitDistance}
          onToggle={setLimitDistance}>
          <Stepper
            label="Distance per day"
            value={maxKm}
            min={50}
            max={2000}
            step={50}
            unit={() => 'km'}
            onChange={setMaxKm}
          />
        </LimitRow>
      </Card>

      <Card title="💰 Budget">
        <FormField label="Currency">
          <ChipSelect
            options={CurrencyOptions}
            value={currency as Currency}
            onChange={setCurrency}
          />
        </FormField>
        <View style={styles.row}>
          {BudgetFields.map(([field, label]) => (
            <View key={field} style={styles.budgetColumn}>
              <TextField
                label={`${label} (${currency})`}
                value={amounts[field]}
                onChangeText={(value) =>
                  setAmounts((current) => ({ ...current, [field]: value }))
                }
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
          ))}
        </View>
      </Card>

      {saveError && (
        <ThemedView
          type="backgroundSelected"
          accessibilityRole="alert"
          style={styles.errorBox}>
          <ThemedText type="small" themeColor="danger">
            {saveError}
          </ThemedText>
        </ThemedView>
      )}

      <PrimaryButton label="Save changes" onPress={handleSave} loading={saving} />
    </>
  );
}

function Card({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <ThemedView type="card" style={styles.card}>
      <ThemedText type="smallBold" style={styles.cardTitle}>
        {title}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function LimitRow({
  label,
  enabled,
  onToggle,
  children,
}: PropsWithChildren<{
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}>) {
  const colors = useTheme();

  return (
    <View style={styles.limit}>
      <View style={styles.limitHeader}>
        <ThemedText type="small" style={styles.limitLabel}>
          {label}
        </ThemedText>
        <Switch
          accessibilityLabel={label}
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
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  title: {
    fontSize: 40,
    lineHeight: 48,
  },

  card: {
    padding: Spacing.four,
    borderRadius: 18,
    gap: Spacing.three,
  },

  cardTitle: {
    fontSize: 18,
  },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  column: {
    flexGrow: 1,
    flexBasis: 240,
  },

  budgetColumn: {
    flexGrow: 1,
    flexBasis: 200,
  },

  limit: {
    gap: Spacing.two,
  },

  limitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  limitLabel: {
    flex: 1,
  },

  errorBox: {
    padding: Spacing.three,
    borderRadius: 12,
  },
});
