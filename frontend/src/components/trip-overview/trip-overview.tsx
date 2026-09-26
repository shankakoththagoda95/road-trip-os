import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ApiError } from '@/api/client';
import { reversePlace } from '@/api/places';
import {
  getTripBudget,
  getTripEv,
  getTripFuel,
  recordTripLocation,
  type Trip,
  type TripRoute,
} from '@/api/trips';
import type { NearestStations } from '@/api/stations';
import { getVehicle } from '@/api/vehicles';
import { getCurrentConditions } from '@/api/weather';
import { RouteMap } from '@/components/route-map/route-map';
import { StationFinder } from '@/components/trip-overview/station-finder';
import type { MapPoint } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { WeatherIcon } from '@/components/weather/weather-icon';
import { Spacing } from '@/constants/theme';
import { vehicleRangeKm } from '@/constants/vehicles';
import { useAsync } from '@/hooks/use-async';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useTheme } from '@/hooks/use-theme';
import { tripEndDate } from '@/utils/dates';
import { energyMode } from '@/utils/energy-draft';
import { formatMoney } from '@/utils/numbers';
import {
  OffRouteKm,
  projectOntoRoute,
  routeLine,
  stopsAlongRoute,
} from '@/utils/route-progress';
import { describeWeather } from '@/utils/weather';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type TripStatus = 'upcoming' | 'in_progress' | 'finished';

// Width from which the dashboard uses its two-row desktop layout.
const WideLayout = 900;

// Positions are stored at most this often, unless the traveller moved far.
const RecordEveryMs = 2 * 60_000;
const RecordAfterKm = 0.5;

/**
 * Trip dashboard: progress along the route, where the traveller is, fuel
 * or battery left, weather, budget and the next stop, on one screen.
 */
export function TripOverview({
  trip,
  route,
  routeLoading,
  onOpenTab,
}: {
  trip: Trip;
  route: TripRoute | null;
  routeLoading: boolean;
  onOpenTab: (tab: 'budget' | 'weather' | 'route') => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= WideLayout;
  const { state: location, start: shareLocation } = useCurrentLocation();
  // Fuel stations / chargers found by the station card, shown on the map.
  const [stations, setStations] = useState<NearestStations | null>(null);
  const position = location.status === 'tracking' ? location.position : null;

  const status = tripStatus(trip, new Date());
  const roundTrip = trip.trip_type === 'round_trip';

  // --- Progress along the route ---
  const line = route?.geometry ? routeLine(route.geometry.coordinates) : null;
  const routeKm = route ? route.distance_meters / 1000 : null;
  // The drawn line and the routed distance differ slightly; report in
  // routed kilometres.
  const scale =
    line && routeKm && line.totalKm > 0 ? routeKm / line.totalKm : 1;
  const stops =
    line && route ? stopsAlongRoute(line, route.points, roundTrip) : [];

  const bestAlong = useStoredProgress(trip.id);
  const projection =
    status === 'in_progress' && line && position
      ? projectOntoRoute(line, position, Math.max(0, bestAlong.value - 5))
      : null;
  const offRoute = projection !== null && projection.offRouteKm > OffRouteKm;
  const alongKm =
    status === 'finished'
      ? (line?.totalKm ?? 0)
      : projection && !offRoute
        ? projection.alongKm
        : status === 'in_progress'
          ? bestAlong.value
          : 0;

  useEffect(() => {
    if (projection && !offRoute && projection.alongKm > bestAlong.value) {
      bestAlong.save(projection.alongKm);
    }
  }, [projection, offRoute, bestAlong]);

  const percent =
    line && line.totalKm > 0
      ? Math.min(100, (alongKm / line.totalKm) * 100)
      : 0;
  const travelledKm = alongKm * scale;
  const nextStop = stops.find((stop) => stop.alongKm > alongKm + 0.3) ?? null;
  const toNextKm = nextStop ? (nextStop.alongKm - alongKm) * scale : null;

  useRecordLocation(trip.id, status === 'in_progress' ? position : null);

  // --- Place, weather, budget, vehicle ---
  const cityKey = position ? roundKey(position) : null;
  const [cityState] = useAsync(
    () =>
      position
        ? reversePlace(position.latitude, position.longitude)
        : undefined,
    [cityKey],
  );

  const startPoint =
    route?.points.find((point) => point.kind === 'start') ?? null;
  const weatherAt = position ?? startPoint;
  const weatherKey = weatherAt ? roundKey(weatherAt) : null;
  const [weatherState] = useAsync(
    () =>
      weatherAt
        ? getCurrentConditions(weatherAt.latitude, weatherAt.longitude, 4)
        : undefined,
    [weatherKey],
  );

  const [budgetState] = useAsync(() => getTripBudget(trip.id), [trip.id]);
  const [vehicleState] = useAsync(
    () =>
      trip.vehicle_id !== null
        ? getVehicle(trip.vehicle_id)
        : Promise.resolve(null),
    [trip.vehicle_id],
  );
  const vehicle = vehicleState.status === 'success' ? vehicleState.data : null;
  const [startLevelState] = useAsync(
    () =>
      vehicle
        ? (energyMode(vehicle) === 'ev'
            ? getTripEv(trip.id).then((ev) => ev.starting_battery_percentage)
            : getTripFuel(trip.id).then((fuel) =>
                vehicle.tank_capacity
                  ? (fuel.starting_fuel / vehicle.tank_capacity) * 100
                  : 100,
              )
          ).catch(() => 100)
        : undefined,
    [vehicle?.id, trip.id],
  );

  const refuel = useRefuelMark(trip.id);
  const range = vehicle
    ? energyMode(vehicle) === 'ev'
      ? vehicleRangeKm(vehicle).electricKm
      : vehicleRangeKm(vehicle).fuelKm
    : null;
  const startLevel =
    startLevelState.status === 'success' ? startLevelState.data : null;
  const energyPercent =
    range && startLevel !== null
      ? clamp(
          refuel.value !== null && travelledKm >= refuel.value
            ? 100 - ((travelledKm - refuel.value) / range) * 100
            : startLevel - (travelledKm / range) * 100,
          0,
          100,
        )
      : null;

  // --- Cards ---
  const progressCard = (
    <Card style={styles.primary}>
      <ProgressRing
        percent={status === 'upcoming' ? 0 : percent}
        status={status}
      />
      <View style={styles.primaryText}>
        <CardLabel icon="flag-checkered" text="Journey progress" />
        <StatusPill status={status} />
        <ThemedText type="small" themeColor="textSecondary">
          {status === 'upcoming'
            ? startsIn(trip)
            : status === 'finished'
              ? `All ${formatKm(routeKm)} driven`
              : position
                ? offRoute
                  ? `You're ${Math.round(projection!.offRouteKm)} km from your route`
                  : `${formatKm(travelledKm)} of ${formatKm(routeKm)}`
                : 'Share your location to track progress'}
        </ThemedText>
      </View>
    </Card>
  );

  const cityCard = (
    <Card style={styles.primary}>
      <View
        style={[
          styles.bigIcon,
          { backgroundColor: 'rgba(14, 165, 233, 0.16)' },
        ]}>
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={30}
          color="#0EA5E9"
        />
      </View>
      <View style={styles.primaryText}>
        <CardLabel icon="map-marker-outline" text="You are in" />
        {position ? (
          cityState.status === 'success' ? (
            <>
              <ThemedText style={styles.bigValue} numberOfLines={1}>
                {cityState.data.name}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                numberOfLines={1}>
                {[cityState.data.region, cityState.data.country]
                  .filter(Boolean)
                  .join(', ')}
              </ThemedText>
            </>
          ) : cityState.status === 'error' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {cityState.error instanceof ApiError &&
              cityState.error.status === 404
                ? 'Somewhere between towns'
                : "Couldn't look up the town right now."}
            </ThemedText>
          ) : (
            <ActivityIndicator />
          )
        ) : (
          <LocationPrompt state={location.status} onShare={shareLocation} />
        )}
      </View>
    </Card>
  );

  const energyCard = (
    <Card style={styles.primary}>
      <EnergyGauge
        percent={energyPercent}
        ev={vehicle ? energyMode(vehicle) === 'ev' : false}
      />
      <View style={styles.primaryText}>
        <CardLabel
          icon={
            vehicle && energyMode(vehicle) === 'ev'
              ? 'battery-charging-outline'
              : 'gas-station-outline'
          }
          text={
            vehicle && energyMode(vehicle) === 'ev'
              ? 'Battery left (est.)'
              : 'Fuel left (est.)'
          }
        />
        {energyPercent !== null && range ? (
          <>
            <ThemedText style={styles.bigValue}>
              {Math.round(energyPercent)}%
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              ≈ {formatKm((energyPercent / 100) * range)} range
              {status === 'upcoming' ? ' at departure' : ''}
            </ThemedText>
            {status === 'in_progress' && (
              <Pressable
                accessibilityRole="button"
                onPress={() => refuel.save(travelledKm)}>
                <ThemedText type="linkPrimary" style={styles.smallLink}>
                  {vehicle && energyMode(vehicle) === 'ev'
                    ? 'I charged up'
                    : 'I filled up'}
                </ThemedText>
              </Pressable>
            )}
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {trip.vehicle_id === null
              ? 'No vehicle on this trip.'
              : vehicle
                ? 'Add the tank or battery size and consumption to your vehicle.'
                : 'Loading…'}
          </ThemedText>
        )}
      </View>
    </Card>
  );

  const stationCard = (
    <Card style={styles.primary}>
      <StationFinder
        vehicle={vehicle}
        position={position}
        locationStatus={location.status}
        onShareLocation={shareLocation}
        onFound={setStations}
      />
    </Card>
  );

  const mapPoints: MapPoint[] = [
    ...(route?.points ?? []).map((point) => ({
      label: point.location,
      latitude: point.latitude,
      longitude: point.longitude,
      kind: point.kind,
    })),
    ...(position
      ? [
          {
            label: 'You are here',
            latitude: position.latitude,
            longitude: position.longitude,
            kind: 'current' as const,
          },
        ]
      : []),
    ...(stations?.stations ?? []).map((station) => ({
      label: `${station.name} · ${station.distance_km.toFixed(1)} km`,
      latitude: station.latitude,
      longitude: station.longitude,
      kind:
        stations?.kind === 'charging' ? ('charge' as const) : ('fuel' as const),
    })),
  ];

  const mapHeight = wide ? 292 : 260;
  const mapCard = (
    <Card style={[styles.mapCard, wide && styles.mapCardWide]}>
      {route ? (
        <RouteMap
          points={mapPoints}
          focus={
            stations && stations.stations.length > 0 && position
              ? [position, ...stations.stations]
              : undefined
          }
          line={route.geometry?.coordinates}
          height={mapHeight}
        />
      ) : (
        <View style={[styles.mapPlaceholder, { height: mapHeight }]}>
          {routeLoading ? (
            <ActivityIndicator />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              The route isn&apos;t available right now.
            </ThemedText>
          )}
        </View>
      )}
    </Card>
  );

  const weather = weatherState.status === 'success' ? weatherState.data : null;
  const weatherCard = (
    <Card style={styles.weatherCard}>
      <View style={styles.weatherNow}>
        {weather ? (
          <WeatherIcon code={weather.weather_code} size={44} />
        ) : (
          <ActivityIndicator />
        )}
        <View style={styles.primaryText}>
          <CardLabel
            icon="weather-partly-cloudy"
            text={
              position
                ? `Weather here${cityState.status === 'success' ? ` · ${cityState.data.name}` : ''}`
                : `Weather in ${startPoint?.location ?? 'the start'}`
            }
          />
          {weather && (
            <ThemedText type="smallBold">
              {Math.round(weather.temperature_c)}°C ·{' '}
              {describeWeather(weather.weather_code).label}
            </ThemedText>
          )}
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => onOpenTab('weather')}>
          <ThemedText type="linkPrimary" style={styles.smallLink}>
            Route weather
          </ThemedText>
        </Pressable>
      </View>
      {weather && weather.next_hours.length > 0 && (
        <View style={styles.hours}>
          {weather.next_hours.slice(0, 4).map((hour, index) => (
            <View key={hour.time} style={styles.hour}>
              <ThemedText type="small" themeColor="textSecondary">
                {index === 0 ? 'Now' : hour.time.slice(11, 16)}
              </ThemedText>
              <WeatherIcon code={hour.weather_code} size={24} />
              <ThemedText type="smallBold">
                {Math.round(hour.temperature_c)}°
              </ThemedText>
              <ThemedText type="small" style={styles.rain}>
                💧{Math.round(hour.precipitation_probability)}%
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );

  const budget =
    budgetState.status === 'success'
      ? formatMoney(budgetState.data.estimated_total, budgetState.data.currency)
      : budgetState.status === 'error'
        ? 'Not set'
        : '…';

  const tiles = (
    <View style={styles.tiles}>
      <Tile
        icon="wallet-outline"
        tint="#22C55E"
        label="Budget"
        value={budget}
        onPress={() => onOpenTab('budget')}
      />
      <Tile
        icon="map-marker-distance"
        tint="#3B82F6"
        label={
          status === 'finished'
            ? 'Next stop'
            : nextStop
              ? `${status === 'upcoming' ? 'First stop' : 'Next'} · ${nextStop.location}`
              : 'Next stop'
        }
        value={
          status === 'finished'
            ? 'Arrived'
            : toNextKm !== null && (status === 'upcoming' || position)
              ? formatKm(toNextKm)
              : '—'
        }
        onPress={() => onOpenTab('route')}
      />
      <Tile
        icon="road-variant"
        tint="#A855F7"
        label="Travelled"
        value={formatKm(travelledKm)}
        detail={routeKm ? `of ${formatKm(routeKm)}` : undefined}
      />
    </View>
  );

  return (
    <View style={styles.dashboard}>
      <View style={[styles.row, !wide && styles.column]}>
        {progressCard}
        {cityCard}
        {energyCard}
        {stationCard}
      </View>

      <View style={[styles.row, !wide && styles.column]}>
        {mapCard}
        <View style={[styles.side, wide && styles.sideWide]}>
          {weatherCard}
          {tiles}
        </View>
      </View>
    </View>
  );
}

// --- Pieces ---

function Card({
  style,
  children,
}: {
  style?: object | object[];
  children: ReactNode;
}) {
  const colors = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: colors.backgroundElement,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

function CardLabel({ icon, text }: { icon: IconName; text: string }) {
  const colors = useTheme();

  return (
    <View style={styles.cardLabel}>
      <MaterialCommunityIcons
        name={icon}
        size={14}
        color={colors.textSecondary}
      />
      <ThemedText
        type="small"
        themeColor="textSecondary"
        numberOfLines={1}
        style={styles.cardLabelText}>
        {text}
      </ThemedText>
    </View>
  );
}

function StatusPill({ status }: { status: TripStatus }) {
  const [label, color] =
    status === 'upcoming'
      ? ['Upcoming', '#3B82F6']
      : status === 'in_progress'
        ? ['In progress', '#22C55E']
        : ['Completed', '#94A3B8'];

  return (
    <View style={[styles.pill, { backgroundColor: `${color}26` }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

function ProgressRing({
  percent,
  status,
}: {
  percent: number;
  status: TripStatus;
}) {
  const colors = useTheme();
  const size = 104;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        status === 'upcoming'
          ? 'Journey not started'
          : `${Math.round(percent)}% of the journey done`
      }>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        {percent > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={status === 'finished' ? '#22C55E' : colors.primary}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(percent / 100) * circumference} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={styles.ringCenter}>
        {status === 'upcoming' ? (
          <MaterialCommunityIcons
            name="calendar-clock"
            size={28}
            color={colors.primary}
          />
        ) : (
          <ThemedText style={styles.ringValue}>
            {Math.round(percent)}%
          </ThemedText>
        )}
      </View>
    </View>
  );
}

function EnergyGauge({ percent, ev }: { percent: number | null; ev: boolean }) {
  const colors = useTheme();
  const segments = 10;
  const filled = percent === null ? 0 : Math.round((percent / 100) * segments);
  const color =
    percent === null
      ? colors.border
      : percent < 20
        ? '#EF4444'
        : percent < 50
          ? '#F59E0B'
          : '#22C55E';

  return (
    <View style={styles.gauge} accessible={false}>
      <MaterialCommunityIcons
        name={ev ? 'lightning-bolt' : 'fuel'}
        size={22}
        color={color}
      />
      <View style={styles.gaugeBars}>
        {Array.from({ length: segments }, (_, index) => (
          <View
            key={index}
            style={[
              styles.gaugeBar,
              {
                backgroundColor:
                  segments - index <= filled
                    ? color
                    : colors.backgroundSelected,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function LocationPrompt({
  state,
  onShare,
}: {
  state: 'idle' | 'locating' | 'tracking' | 'denied' | 'unavailable';
  onShare: () => void;
}) {
  const colors = useTheme();

  if (state === 'locating') {
    return (
      <View style={styles.locating}>
        <ActivityIndicator />
        <ThemedText type="small" themeColor="textSecondary">
          Finding you…
        </ThemedText>
      </View>
    );
  }

  if (state === 'denied') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Location is blocked. Allow it for this site in your browser settings,
        then reload.
      </ThemedText>
    );
  }

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {state === 'unavailable'
          ? "Your location isn't available right now."
          : 'Used only while this page is open.'}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onShare}
        style={({ hovered, pressed }) => [
          styles.shareButton,
          { backgroundColor: colors.primary },
          (hovered || pressed) && styles.pressed,
        ]}>
        <MaterialCommunityIcons
          name="crosshairs-gps"
          size={16}
          color="#FFFFFF"
        />
        <ThemedText type="smallBold" style={styles.shareText}>
          Share my location
        </ThemedText>
      </Pressable>
    </>
  );
}

function Tile({
  icon,
  tint,
  label,
  value,
  detail,
  onPress,
}: {
  icon: IconName;
  tint: string;
  label: string;
  value: string;
  detail?: string;
  onPress?: () => void;
}) {
  const colors = useTheme();
  const content = (
    <>
      <View style={[styles.tileIcon, { backgroundColor: `${tint}2E` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={tint} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.tileValue} numberOfLines={1}>
        {value}
      </ThemedText>
      {detail && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {detail}
        </ThemedText>
      )}
    </>
  );

  const style = [
    styles.tile,
    { borderColor: colors.border, backgroundColor: colors.backgroundElement },
  ];

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }) => [
        ...style,
        hovered && { backgroundColor: colors.backgroundSelected },
      ]}>
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

// --- Helpers ---

function tripStatus(trip: Trip, now: Date): TripStatus {
  const departure = new Date(trip.departure_at);
  const lastDay = tripEndDate(departure, trip.duration_days);
  const end = new Date(
    lastDay.getFullYear(),
    lastDay.getMonth(),
    lastDay.getDate(),
    23,
    59,
    59,
  );

  if (now < departure) return 'upcoming';
  if (now > end) return 'finished';
  return 'in_progress';
}

function startsIn(trip: Trip) {
  const departure = new Date(trip.departure_at);
  const today = new Date();
  const days = Math.round(
    (new Date(
      departure.getFullYear(),
      departure.getMonth(),
      departure.getDate(),
    ).getTime() -
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).getTime()) /
      86_400_000,
  );
  const time = departure.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (days <= 0) return `Starts today at ${time}`;
  if (days === 1) return `Starts tomorrow at ${time}`;
  return `Starts in ${days} days`;
}

function formatKm(km: number | null) {
  return km === null ? '—' : `${Math.round(km).toLocaleString()} km`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// ~1 km buckets, so small GPS jitter doesn't refetch.
function roundKey(point: { latitude: number; longitude: number }) {
  return `${point.latitude.toFixed(2)},${point.longitude.toFixed(2)}`;
}

function readNumber(key: string) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && localStorage.getItem(key) !== null
      ? value
      : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable: the value lasts until the page closes.
  }
}

/**
 * Furthest point reached along the route (km), kept in this browser so a
 * round trip's way home isn't mistaken for the way out after a reload.
 */
function useStoredProgress(tripId: number) {
  const key = `road-trip-os.trip-progress.${tripId}`;
  const [value, setValue] = useState(() => readNumber(key) ?? 0);

  return {
    value,
    save: (km: number) => {
      setValue(km);
      writeNumber(key, km);
    },
  };
}

/**
 * Travelled distance (km) at the last fill-up / charge, kept in this
 * browser; null when there hasn't been one.
 */
function useRefuelMark(tripId: number) {
  const key = `road-trip-os.trip-refuel.${tripId}`;
  const [value, setValue] = useState(() => readNumber(key));

  return {
    value,
    save: (km: number) => {
      setValue(km);
      writeNumber(key, km);
    },
  };
}

/**
 * Sends the position to the trip's GPS track now and then while the trip
 * is under way.
 */
function useRecordLocation(
  tripId: number,
  position: { latitude: number; longitude: number; timestamp: number } | null,
) {
  const last = useRef<{
    latitude: number;
    longitude: number;
    at: number;
  } | null>(null);

  useEffect(() => {
    if (!position) return;

    const previous = last.current;
    const movedKm = previous
      ? Math.hypot(
          (position.latitude - previous.latitude) * 111,
          (position.longitude - previous.longitude) *
            111 *
            Math.cos((position.latitude * Math.PI) / 180),
        )
      : Infinity;

    if (
      previous &&
      Date.now() - previous.at < RecordEveryMs &&
      movedKm < RecordAfterKm
    ) {
      return;
    }

    last.current = {
      latitude: position.latitude,
      longitude: position.longitude,
      at: Date.now(),
    };
    recordTripLocation(tripId, position.latitude, position.longitude).catch(
      () => {
        // Tracking is best effort; the dashboard works without it.
      },
    );
  }, [tripId, position]);
}

const styles = StyleSheet.create({
  dashboard: {
    gap: Spacing.three,
  },

  row: {
    flexDirection: 'row',
    gap: Spacing.three,
  },

  column: {
    flexDirection: 'column',
  },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
  },

  primary: {
    flex: 1,
    minHeight: 120,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  primaryText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },

  cardLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },

  cardLabelText: {
    flexShrink: 1,
  },

  bigIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
  },

  smallLink: {
    fontSize: 13,
  },

  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },

  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringValue: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
  },

  gauge: {
    width: 56,
    alignItems: 'center',
    gap: Spacing.one,
  },

  gaugeBars: {
    width: 34,
    gap: 3,
    padding: 3,
    borderRadius: 8,
  },

  gaugeBar: {
    height: 6,
    borderRadius: 2,
  },

  locating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  shareButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.one,
  },

  shareText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.88,
  },

  mapCard: {
    padding: Spacing.two,
  },

  mapCardWide: {
    flex: 1.35,
  },

  mapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  side: {
    gap: Spacing.three,
  },

  sideWide: {
    flex: 1,
  },

  weatherCard: {
    gap: Spacing.three,
  },

  weatherNow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  hours: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  hour: {
    alignItems: 'center',
    gap: Spacing.half,
  },

  rain: {
    fontSize: 11,
    lineHeight: 14,
    color: '#60A5FA',
  },

  tiles: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.three,
  },

  tile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.half,
  },

  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },

  tileValue: {
    fontSize: 18,
    lineHeight: 24,
  },
});
