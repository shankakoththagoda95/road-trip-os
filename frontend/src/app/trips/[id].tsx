import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  type PropsWithChildren,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import {
  getRouteConditions,
  getRouteFees,
  type RoutePoint,
  type RoutePointInput,
  type RoutePreviewRequest,
} from '@/api/routes';
import {
  deleteTrip,
  downloadTripCalendar,
  getSavedItinerary,
  getTrip,
  getTripBudget,
  getTripRoute,
  type Trip,
  type TripRoute,
} from '@/api/trips';
import { getVehicle } from '@/api/vehicles';
import { TripChecklistSection } from '@/components/checklist/trip-checklist-section';
import { PrimaryButton } from '@/components/form/primary-button';
import { RouteMap } from '@/components/route-map/route-map';
import { MarkerColors } from '@/components/route-map/types';
import { Screen } from '@/components/screen';
import { TabBar, type TabItem } from '@/components/tab-bar';
import { TripOverview } from '@/components/trip-overview/trip-overview';
import { VehicleIcon } from '@/components/vehicles/vehicle-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fuelTypeLabel, vehicleMakeModel } from '@/constants/vehicles';
import { type AsyncState, useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import {
  formatDateTime,
  formatShortDate,
  pluralize,
  tripEndDate,
} from '@/utils/dates';
import { formatMoney } from '@/utils/numbers';
import { saveFile } from '@/utils/save-file';
import { formatDistance, formatDuration } from '@/utils/units';
import { describeWeather } from '@/utils/weather';

export default function TripDetailScreen() {
  const router = useRouter();
  const { id, tab: tabParam } = useLocalSearchParams<{
    id: string;
    tab?: string;
  }>();
  const tripId = Number(id);

  // The open tab lives in the URL (?tab=budget), so a refresh or coming
  // back from Edit keeps it. Tabs opened once stay mounted (just hidden),
  // so switching back doesn't reload them.
  const [visited, setVisited] = useState<ReadonlySet<DetailTab>>(new Set());

  // Refetch when coming back to this page (e.g. after editing). Old data
  // stays on screen until the new data arrives.
  const [refreshKey, setRefreshKey] = useState(0);
  const focusedBefore = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        setRefreshKey((key) => key + 1);
      }
      focusedBefore.current = true;
    }, []),
  );

  const [tripState, reloadTrip] = useAsync(
    () => getTrip(tripId),
    [tripId, refreshKey],
  );
  const [routeState, reloadRoute] = useAsync(
    () => getTripRoute(tripId),
    [tripId, refreshKey],
  );

  if (tripState.status === 'loading') {
    return (
      <Screen maxWidth={1200}>
        <Loading label="Loading your trip…" />
      </Screen>
    );
  }

  if (tripState.status === 'error') {
    const notFound =
      tripState.error instanceof ApiError && tripState.error.status === 404;

    return (
      <Screen maxWidth={1200}>
        <BackLink />
        <ThemedText type="subtitle">
          {notFound ? 'Trip not found' : "Couldn't load this trip"}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {notFound ? 'It may have been deleted.' : tripState.message}
        </ThemedText>
        {!notFound && <RetryLink onPress={reloadTrip} />}
      </Screen>
    );
  }

  const trip = tripState.data;
  const route = routeState.status === 'success' ? routeState.data : null;

  const tabs = DetailTabs.filter(
    (item) => item.id !== 'vehicle' || trip.vehicle_id !== null,
  );
  const tab: DetailTab = tabs.some((item) => item.id === tabParam)
    ? (tabParam as DetailTab)
    : 'overview';

  if (!visited.has(tab)) {
    setVisited(new Set(visited).add(tab));
  }

  // Fees and weather are worked out from the route.
  const withRoute = (content: (data: TripRoute) => ReactNode) =>
    route ? (
      content(route)
    ) : (
      <Section title="🗺️ Route">
        <AsyncContent
          state={routeState}
          loadingLabel="Calculating your route…"
          onRetry={reloadRoute}>
          {() => null}
        </AsyncContent>
      </Section>
    );

  function renderTab(id: DetailTab) {
    switch (id) {
      case 'overview':
        return (
          <TripOverview
            trip={trip}
            route={route}
            routeLoading={routeState.status === 'loading'}
            onOpenTab={(next) => router.setParams({ tab: next })}
          />
        );
      case 'route':
        return (
          <Section title="🗺️ Route & stops">
            <AsyncContent
              state={routeState}
              loadingLabel="Calculating your route…"
              onRetry={reloadRoute}>
              {(data) => <RouteSection route={data} />}
            </AsyncContent>
          </Section>
        );
      case 'itinerary':
        return (
          <Section title="📅 Itinerary">
            <AsyncContent
              state={routeState}
              loadingLabel="Building your day-by-day plan…"
              onRetry={reloadRoute}>
              {(data) => <ItinerarySection trip={trip} route={data} />}
            </AsyncContent>
          </Section>
        );
      case 'budget':
        return <BudgetSection tripId={trip.id} refreshKey={refreshKey} />;
      case 'vehicle':
        return trip.vehicle_id !== null ? (
          <VehicleSection vehicleId={trip.vehicle_id} />
        ) : null;
      case 'checklist':
        return (
          <TripChecklistSection tripId={trip.id} refreshKey={refreshKey} />
        );
      case 'fees':
        return withRoute((data) => <FeesSection trip={trip} route={data} />);
      case 'weather':
        return withRoute((data) => <WeatherSection trip={trip} route={data} />);
    }
  }

  return (
    <Screen maxWidth={1200}>
      <BackLink />
      <TripHeader
        trip={trip}
        refreshKey={refreshKey}
        onDeleted={() => router.replace('/trips')}
      />

      <TabBar
        tabs={tabs}
        selected={tab}
        onSelect={(next) => router.setParams({ tab: next })}
        accessibilityLabel="Trip details"
      />

      {tabs
        .filter((item) => visited.has(item.id) || item.id === tab)
        .map((item) => (
          <View
            key={item.id}
            role="tabpanel"
            style={item.id === tab ? styles.tabPanel : styles.hiddenTab}>
            {renderTab(item.id)}
          </View>
        ))}
    </Screen>
  );
}

type DetailTab =
  | 'overview'
  | 'route'
  | 'itinerary'
  | 'budget'
  | 'vehicle'
  | 'checklist'
  | 'fees'
  | 'weather';

const DetailTabs: TabItem<DetailTab>[] = [
  { id: 'overview', label: 'Overview', icon: 'view-dashboard-outline' },
  { id: 'route', label: 'Route', icon: 'map-marker-path' },
  { id: 'itinerary', label: 'Itinerary', icon: 'calendar-month-outline' },
  { id: 'budget', label: 'Budget', icon: 'wallet-outline' },
  { id: 'vehicle', label: 'Vehicle', icon: 'car-outline' },
  { id: 'checklist', label: 'Checklist', icon: 'clipboard-check-outline' },
  { id: 'fees', label: 'Road fees', icon: 'highway' },
  { id: 'weather', label: 'Weather', icon: 'weather-partly-cloudy' },
];

// --- Header ---

function TripHeader({
  trip,
  refreshKey,
  onDeleted,
}: {
  trip: Trip;
  refreshKey: number;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const departure = new Date(trip.departure_at);
  const end = tripEndDate(departure, trip.duration_days);

  const [itineraryState] = useAsync(
    () => getSavedItinerary(trip.id),
    [trip.id, refreshKey],
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState<'delete' | 'calendar' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy('delete');
    setActionError(null);

    try {
      await deleteTrip(trip.id);
      onDeleted();
    } catch (error) {
      setActionError(errorMessage(error));
      setBusy(null);
    }
  }

  async function handleCalendar() {
    setBusy('calendar');
    setActionError(null);

    try {
      const file = await downloadTripCalendar(trip.id);
      saveFile(file, `${slugify(trip.name) || 'road-trip'}.ics`);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerInfo}>
          <ThemedText type="title" style={styles.title}>
            {trip.name}
          </ThemedText>
          <ThemedText style={styles.routeLine}>
            {trip.start_location} {trip.trip_type === 'round_trip' ? '⇄' : '→'}{' '}
            {trip.destination}
          </ThemedText>

          <View style={styles.meta}>
            <ThemedText type="small" themeColor="textSecondary">
              📅 {formatDateTime(trip.departure_at)}
              {trip.duration_days > 1 ? ` – ${formatShortDate(end)}` : ''}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              🕒 {pluralize(trip.duration_days, 'day', 'days')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              👥 {pluralize(trip.travelers, 'traveler', 'travelers')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {trip.trip_type === 'round_trip' ? '⇄ Round trip' : '→ One way'}
            </ThemedText>
            {trip.max_driving_hours_per_day !== null && (
              <ThemedText type="small" themeColor="textSecondary">
                ⏱️ Max {trip.max_driving_hours_per_day} h/day
              </ThemedText>
            )}
            {trip.max_distance_per_day !== null && (
              <ThemedText type="small" themeColor="textSecondary">
                📏 Max {trip.max_distance_per_day} km/day
              </ThemedText>
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.primaryAction}>
            <PrimaryButton
              label="✏️ Edit trip"
              onPress={() =>
                router.push({
                  pathname: '/trips/[id]/edit',
                  params: { id: String(trip.id) },
                })
              }
            />
          </View>

          {itineraryState.status === 'success' && (
            <ActionButton
              label={busy === 'calendar' ? 'Preparing…' : '📆 Add to calendar'}
              onPress={handleCalendar}
              disabled={busy !== null}
            />
          )}

          {confirmingDelete ? (
            <View style={styles.confirmRow}>
              <ThemedText type="small">Delete this trip?</ThemedText>
              <ActionButton
                label={busy === 'delete' ? 'Deleting…' : 'Delete'}
                onPress={handleDelete}
                disabled={busy !== null}
                danger
              />
              <ActionButton
                label="Cancel"
                onPress={() => setConfirmingDelete(false)}
                disabled={busy !== null}
              />
            </View>
          ) : (
            <ActionButton
              label="🗑️ Delete"
              onPress={() => setConfirmingDelete(true)}
              disabled={busy !== null}
            />
          )}
        </View>
      </View>

      {actionError && (
        <ThemedText type="small" themeColor="danger">
          {actionError}
        </ThemedText>
      )}
    </View>
  );
}

// --- Route ---

function RouteSection({ route }: { route: TripRoute }) {
  const stops = route.points.filter((point) => point.kind === 'stop');

  return (
    <View style={styles.sectionBody}>
      <RouteMap
        points={route.points.map((point) => ({
          label: point.location,
          latitude: point.latitude,
          longitude: point.longitude,
          kind: point.kind,
        }))}
        line={route.geometry?.coordinates}
      />

      <View style={styles.tiles}>
        <Tile label="Distance" value={formatDistance(route.distance_meters)} />
        <Tile
          label="Driving time"
          value={formatDuration(route.duration_seconds)}
        />
        <Tile label="Stops" value={String(stops.length)} />
      </View>

      <View>
        {route.points.map((point, index) => (
          <PointRow
            key={`${point.kind}-${index}`}
            point={point}
            number={
              point.kind === 'stop' ? stops.indexOf(point) + 1 : undefined
            }
          />
        ))}
      </View>
    </View>
  );
}

function PointRow({ point, number }: { point: RoutePoint; number?: number }) {
  const colors = useTheme();

  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: MarkerColors[point.kind] }]}>
        {number !== undefined && (
          <ThemedText style={styles.dotText}>{number}</ThemedText>
        )}
      </View>
      <ThemedText type="smallBold" style={styles.rowTitle}>
        {point.location}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {point.kind === 'start'
          ? 'Start'
          : point.kind === 'destination'
            ? 'Destination'
            : 'Stop'}
      </ThemedText>
    </View>
  );
}

// --- Itinerary ---

function ItinerarySection({ trip, route }: { trip: Trip; route: TripRoute }) {
  const departure = new Date(trip.departure_at);

  if (route.days.length === 0) {
    return (
      <View style={styles.sectionBody}>
        {route.problems.map((problem) => (
          <ThemedText key={problem} type="small" themeColor="warning">
            ⚠️ {problem}
          </ThemedText>
        ))}
      </View>
    );
  }

  const byDay = new Map(route.days.map((day) => [day.day_number, day]));
  const lastDay = Math.max(trip.duration_days, ...byDay.keys());
  let location = trip.start_location;

  const rows: ReactNode[] = [];

  for (let dayNumber = 1; dayNumber <= lastDay; dayNumber++) {
    const day = byDay.get(dayNumber);
    const date = new Date(departure);
    date.setDate(date.getDate() + dayNumber - 1);

    if (day) {
      const from = day.legs[0]?.from_location ?? location;
      const to = day.legs[day.legs.length - 1]?.to_location ?? location;
      location = to;

      rows.push(
        <DayRow
          key={dayNumber}
          label={`Day ${dayNumber} · ${formatShortDate(date)}`}
          title={`🚗 ${from} → ${to}`}
          detail={`${formatDistance(day.total_distance_meters)} · ${formatDuration(day.total_duration_seconds)}`}
          warning={
            day.driving_time_status === 'exceeds_limit' ||
            day.distance_status === 'exceeds_limit'
          }
        />,
      );
    } else {
      rows.push(
        <DayRow
          key={dayNumber}
          label={`Day ${dayNumber} · ${formatShortDate(date)}`}
          title={`🏖️ Free day in ${location}`}
        />,
      );
    }
  }

  return (
    <View style={styles.sectionBody}>
      {route.problems.map((problem) => (
        <ThemedText key={problem} type="small" themeColor="warning">
          ⚠️ {problem}
        </ThemedText>
      ))}
      {rows}
    </View>
  );
}

function DayRow({
  label,
  title,
  detail,
  warning = false,
}: {
  label: string;
  title: string;
  detail?: string;
  warning?: boolean;
}) {
  const colors = useTheme();

  return (
    <View style={[styles.dayRow, { borderColor: colors.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{title}</ThemedText>
      {detail && (
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      )}
      {warning && (
        <ThemedText type="small" themeColor="danger">
          Over your daily limit
        </ThemedText>
      )}
    </View>
  );
}

// --- Budget ---

function BudgetSection({
  tripId,
  refreshKey,
}: {
  tripId: number;
  refreshKey: number;
}) {
  const router = useRouter();
  const [state, reload] = useAsync(
    () => getTripBudget(tripId),
    [tripId, refreshKey],
  );
  const missing =
    state.status === 'error' &&
    state.error instanceof ApiError &&
    state.error.status === 404;

  return (
    <Section title="💰 Budget">
      {missing ? (
        <View style={styles.sectionBody}>
          <ThemedText type="small" themeColor="textSecondary">
            No budget for this trip yet.
          </ThemedText>
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              router.push({
                pathname: '/trips/[id]/edit',
                params: { id: String(tripId) },
              })
            }>
            <ThemedText type="linkPrimary">Add a budget →</ThemedText>
          </Pressable>
        </View>
      ) : (
        <AsyncContent
          state={state}
          loadingLabel="Loading budget…"
          onRetry={reload}>
          {(budget) => {
            const money = (amount: number) =>
              formatMoney(amount, budget.currency);
            const lines = (
              [
                ['Fuel', budget.estimated_fuel_cost],
                ['Charging', budget.estimated_ev_charging_cost],
                ['Food', budget.estimated_food_cost],
                ['Tolls', budget.estimated_toll_cost],
                ['Parking', budget.estimated_parking_cost],
                ['Other', budget.estimated_other_cost],
              ] as const
            ).filter(([, value]) => value > 0);

            return (
              <View style={styles.sectionBody}>
                {lines.map(([label, value]) => (
                  <KeyValue key={label} label={label} value={money(value)} />
                ))}
                <KeyValue
                  label="Estimated total"
                  value={money(budget.estimated_total)}
                  strong
                />
                {budget.actual_total > 0 && (
                  <KeyValue
                    label="Spent so far"
                    value={`${money(budget.actual_total)} (${money(budget.remaining_budget)} left)`}
                  />
                )}
              </View>
            );
          }}
        </AsyncContent>
      )}
    </Section>
  );
}

// --- Vehicle ---

function VehicleSection({ vehicleId }: { vehicleId: number }) {
  const [state, reload] = useAsync(() => getVehicle(vehicleId), [vehicleId]);

  return (
    <Section title="🚙 Vehicle">
      <AsyncContent
        state={state}
        loadingLabel="Loading vehicle…"
        onRetry={reload}>
        {(vehicle) => (
          <View style={styles.sectionBody}>
            <View style={styles.vehicleRow}>
              <VehicleIcon type={vehicle.vehicle_type} size={36} />
              <ThemedText type="smallBold">{vehicle.name}</ThemedText>
            </View>
            {vehicleMakeModel(vehicle) && (
              <ThemedText type="small" themeColor="textSecondary">
                {vehicleMakeModel(vehicle)}
              </ThemedText>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              {[
                fuelTypeLabel(vehicle.fuel_type),
                vehicle.fuel_consumption &&
                  `${vehicle.fuel_consumption} L/100 km`,
                vehicle.tank_capacity && `${vehicle.tank_capacity} L tank`,
                vehicle.energy_consumption &&
                  `${vehicle.energy_consumption} kWh/100 km`,
                vehicle.battery_capacity &&
                  `${vehicle.battery_capacity} kWh battery`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </View>
        )}
      </AsyncContent>
    </Section>
  );
}

// --- Road fees & borders ---

function routeRequest(
  trip: Trip,
  route: TripRoute,
): RoutePreviewRequest | null {
  const toInput = (point: RoutePoint): RoutePointInput => ({
    location: point.location,
    latitude: point.latitude,
    longitude: point.longitude,
  });
  const start = route.points.find((point) => point.kind === 'start');
  const destination = route.points.find(
    (point) => point.kind === 'destination',
  );

  if (!start || !destination) {
    return null;
  }

  return {
    start: toInput(start),
    destination: toInput(destination),
    stops: route.points.filter((point) => point.kind === 'stop').map(toInput),
    trip_type: trip.trip_type,
  };
}

function FeesSection({ trip, route }: { trip: Trip; route: TripRoute }) {
  const request = routeRequest(trip, route);
  const [state, reload] = useAsync(
    () =>
      request ? getRouteFees({ ...request, vehicle_type: null }) : undefined,
    [JSON.stringify(request)],
  );

  return (
    <Section title="🛂 Road fees & borders">
      <AsyncContent
        state={state}
        loadingLabel="Checking countries and fees…"
        onRetry={reload}>
        {(fees) => (
          <View style={styles.sectionBody}>
            <ThemedText type="small">
              {fees.countries
                .map(
                  (country) =>
                    `${country.name} (${Math.round(country.distance_km)} km)`,
                )
                .join(' → ')}
            </ThemedText>
            {fees.fees.map((fee, index) => (
              <KeyValue
                key={index}
                label={`${fee.country_code} · ${fee.name}`}
                value={
                  fee.amount_eur !== null
                    ? `≈ ${formatMoney(fee.amount_eur, 'EUR')}`
                    : 'Info'
                }
              />
            ))}
            <KeyValue
              label="Estimated road fees"
              value={
                fees.total_eur > 0
                  ? `≈ ${formatMoney(fees.total_eur, 'EUR')}`
                  : 'None expected'
              }
              strong
            />
          </View>
        )}
      </AsyncContent>
    </Section>
  );
}

// --- Weather ---

function WeatherSection({ trip, route }: { trip: Trip; route: TripRoute }) {
  const request = routeRequest(trip, route);
  const [state, reload] = useAsync(
    () =>
      request
        ? getRouteConditions({
            ...request,
            departure_at: trip.departure_at,
            max_driving_hours_per_day: trip.max_driving_hours_per_day,
          })
        : undefined,
    [
      JSON.stringify(request),
      trip.departure_at,
      trip.max_driving_hours_per_day,
    ],
  );

  return (
    <Section title="🌦️ Weather & conditions">
      <AsyncContent
        state={state}
        loadingLabel="Checking the forecast…"
        onRetry={reload}>
        {(conditions) => (
          <View style={styles.sectionBody}>
            {conditions.warnings.map((warning) => (
              <ThemedText key={warning} type="small" themeColor="warning">
                ⚠️ {warning}
              </ThemedText>
            ))}
            {conditions.weather.map((entry, index) => {
              const weather = entry.forecast
                ? describeWeather(entry.forecast.weather_code)
                : null;

              return (
                <KeyValue
                  key={index}
                  label={`${entry.location} · ${formatShortDate(new Date(`${entry.date}T00:00`))}`}
                  value={
                    entry.forecast && weather
                      ? `${weather.emoji} ${Math.round(entry.forecast.temperature_max_c)}° / ${Math.round(entry.forecast.temperature_min_c)}°`
                      : 'Forecast not out yet'
                  }
                />
              );
            })}
            {conditions.terrain && (
              <KeyValue
                label="Highest point"
                value={`${Math.round(conditions.terrain.max_elevation_m)} m`}
              />
            )}
          </View>
        )}
      </AsyncContent>
    </Section>
  );
}

// --- Shared bits ---

function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <ThemedView type="card" style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function AsyncContent<T>({
  state,
  loadingLabel,
  onRetry,
  children,
}: {
  state: AsyncState<T>;
  loadingLabel: string;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  if (state.status === 'loading') {
    return <Loading label={loadingLabel} />;
  }

  if (state.status === 'error') {
    return (
      <View style={styles.sectionBody}>
        <ThemedText type="small" themeColor="danger">
          {state.message}
        </ThemedText>
        <RetryLink onPress={onRetry} />
      </View>
    );
  }

  return <>{children(state.data)}</>;
}

function Loading({ label }: { label: string }) {
  const colors = useTheme();

  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function RetryLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <ThemedText type="linkPrimary">Try again</ThemedText>
    </Pressable>
  );
}

function BackLink() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.navigate('/trips')}
      style={styles.backLink}>
      <ThemedText type="linkPrimary">← All trips</ThemedText>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          borderColor: danger ? colors.danger : colors.border,
          backgroundColor: danger ? colors.danger : colors.backgroundElement,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText
        type="smallBold"
        style={danger ? styles.dangerText : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundSelected" style={styles.tile}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.tileValue}>{value}</ThemedText>
    </ThemedView>
  );
}

function KeyValue({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.keyValue}>
      <ThemedText
        type={strong ? 'smallBold' : 'small'}
        themeColor={strong ? 'text' : 'textSecondary'}
        style={styles.keyLabel}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.keyValueText}>
        {value}
      </ThemedText>
    </View>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const styles = StyleSheet.create({
  backLink: {
    alignSelf: 'flex-start',
  },

  header: {
    gap: Spacing.two,
  },

  // Title and details on the left, actions on the right (wrapping below
  // on narrow screens), to leave room for the tabs.
  headerTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  headerInfo: {
    flexShrink: 1,
    minWidth: 280,
    gap: Spacing.one,
  },

  title: {
    fontSize: 32,
    lineHeight: 40,
  },

  routeLine: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },

  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },

  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },

  primaryAction: {
    minWidth: 160,
  },

  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  actionButton: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dangerText: {
    color: '#FFFFFF',
  },

  tabPanel: {
    gap: Spacing.four,
  },

  hiddenTab: {
    display: 'none',
  },

  section: {
    padding: Spacing.four,
    borderRadius: 18,
    gap: Spacing.three,
  },

  sectionTitle: {
    fontSize: 18,
  },

  sectionBody: {
    gap: Spacing.two,
  },

  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  tile: {
    flexGrow: 1,
    flexBasis: 120,
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.half,
  },

  tileValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  rowTitle: {
    flex: 1,
  },

  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dotText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  dayRow: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  keyValue: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  keyLabel: {
    flexShrink: 1,
  },

  keyValueText: {
    textAlign: 'right',
  },

  pressed: {
    opacity: 0.8,
  },

  disabled: {
    opacity: 0.5,
  },
});
