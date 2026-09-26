import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { type ComponentProps, Fragment, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { errorMessage } from '@/api/client';
import { getRouteConditions, type RoutePointWeather } from '@/api/routes';
import {
  type CurrentConditions,
  getCurrentConditions,
  type RoadConditionLevel,
} from '@/api/weather';
import { ModalDialog } from '@/components/modal-dialog';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { MarkerColors } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ElevationChart } from '@/components/weather/elevation-chart';
import { WeatherIcon } from '@/components/weather/weather-icon';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import {
  buildConditionsRequest,
  conditionsKey,
  currentConditions,
} from '@/utils/conditions-draft';
import { formatShortDate } from '@/utils/dates';
import { placeFor, routeParts } from '@/utils/route-draft';
import { formatDistance, formatDuration } from '@/utils/units';
import { describeWeather } from '@/utils/weather';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type TemperatureUnit = 'C' | 'F';

// Open-Meteo daily forecasts reach 16 days ahead.
const ForecastDays = 16;

// Warnings shown before "View details".
const WarningsPreview = 2;

const RoadColors: Record<RoadConditionLevel, string> = {
  good: '#22C55E',
  caution: '#F59E0B',
  poor: '#EF4444',
};

const VisibilityLabels = {
  excellent: 'Excellent',
  good: 'Good',
  moderate: 'Moderate',
  poor: 'Poor',
} as const;

export default function ConditionsStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, setConditions, completeStep } = useTripDraft();

  const request = buildConditionsRequest(draft);
  const requestKey = request ? conditionsKey(request) : null;
  const conditions = currentConditions(draft);
  const hasConditions = conditions !== null;

  const [unit, setUnit] = useState<TemperatureUnit>('C');
  const [chartOpen, setChartOpen] = useState(false);

  // Retrying bumps this so the effect runs again.
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(
    null,
  );
  const failureKey = `${requestKey}:${attempt}`;
  const error = failure?.key === failureKey ? failure.message : null;

  useEffect(() => {
    if (!requestKey || hasConditions) {
      return;
    }

    let cancelled = false;

    getRouteConditions(JSON.parse(requestKey))
      .then((data) => {
        if (!cancelled) {
          setConditions({ key: requestKey, data });
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
  }, [requestKey, hasConditions, failureKey, setConditions]);

  function handleContinue() {
    completeStep('conditions');

    const { next } = getTripStep('conditions');
    router.navigate(next?.href ?? '/trips/new');
  }

  if (!request) {
    return (
      <WizardStepScreen stepId="conditions" onContinue={handleContinue}>
        <ThemedText type="smallBold">Plan your route first</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Weather and terrain are checked along your route on the days
          you&apos;ll be driving.
        </ThemedText>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/trips/new/route')}>
          <ThemedText type="linkPrimary">Go to Route & Destinations →</ThemedText>
        </Pressable>
      </WizardStepScreen>
    );
  }

  const { start } = routeParts(draft.details);
  const startPlace = placeFor(draft, start);
  const route = draft.route.preview?.data ?? null;

  // "Hallstatt, Austria" -> "Austria".
  const countryOf = (location: string) =>
    placeFor(draft, location)?.displayName.split(',').at(-1)?.trim() ?? null;

  return (
    <WizardStepScreen stepId="conditions" onContinue={handleContinue}>
      {startPlace && (
        <CurrentWeather
          place={start}
          latitude={startPlace.latitude}
          longitude={startPlace.longitude}
          unit={unit}
        />
      )}

      {!conditions && !error && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Checking the forecast and terrain along your route…
          </ThemedText>
        </View>
      )}

      {error && (
        <ThemedView
          type="backgroundSelected"
          accessibilityRole="alert"
          style={styles.errorBox}>
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

      {conditions && (
        <>
          <Warnings
            warnings={conditions.warnings}
            partial={conditions.weather.some((entry) => !entry.forecast_available)}
          />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Weather along the way
              </ThemedText>
              <UnitToggle unit={unit} onChange={setUnit} />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.cities}>
              {conditions.weather.map((entry, index) => (
                <Fragment key={index}>
                  {index > 0 && (
                    <View style={styles.cityArrow}>
                      <MaterialCommunityIcons
                        name="arrow-right"
                        size={18}
                        color={colors.textSecondary}
                      />
                    </View>
                  )}
                  <CityTile
                    entry={entry}
                    number={index + 1}
                    country={countryOf(entry.location)}
                    unit={unit}
                  />
                </Fragment>
              ))}
            </ScrollView>

            {conditions.unavailable.includes('weather') && (
              <ThemedText type="small" themeColor="warning">
                Some forecasts couldn&apos;t be loaded. Try again later.
              </ThemedText>
            )}
          </View>

          <View style={styles.bottomRow}>
            <View
              style={[
                styles.panel,
                styles.chartPanel,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}>
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  Route Terrain & Elevation
                </ThemedText>
                {conditions.elevation_profile.length > 1 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Enlarge elevation chart"
                    onPress={() => setChartOpen(true)}
                    style={({ hovered }) => [
                      styles.iconButton,
                      { borderColor: colors.border },
                      hovered && { backgroundColor: colors.backgroundSelected },
                    ]}>
                    <MaterialCommunityIcons
                      name="arrow-expand"
                      size={18}
                      color={colors.text}
                    />
                  </Pressable>
                )}
              </View>

              {conditions.elevation_profile.length > 1 ? (
                <ElevationChart points={conditions.elevation_profile} />
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Elevation data is unavailable right now.
                </ThemedText>
              )}
            </View>

            <View
              style={[
                styles.panel,
                styles.glancePanel,
                { borderColor: colors.border, backgroundColor: colors.backgroundElement },
              ]}>
              <ThemedText type="smallBold" style={styles.sectionTitle}>
                Trip at a glance
              </ThemedText>
              <View style={styles.glanceGrid}>
                <GlanceTile
                  icon="road-variant"
                  tint="#A855F7"
                  value={route ? formatDistance(route.distance_meters) : '—'}
                  label="Total distance"
                />
                <GlanceTile
                  icon="image-filter-hdr"
                  tint="#38BDF8"
                  value={
                    conditions.terrain
                      ? `${Math.round(conditions.terrain.max_elevation_m).toLocaleString()} m`
                      : '—'
                  }
                  label="Highest point"
                />
                <GlanceTile
                  icon="arrow-down-bold"
                  tint="#22C55E"
                  value={
                    conditions.terrain
                      ? `${Math.round(conditions.terrain.min_elevation_m).toLocaleString()} m`
                      : '—'
                  }
                  label="Lowest point"
                />
                <GlanceTile
                  icon="clock-outline"
                  tint="#3B82F6"
                  value={route ? formatDuration(route.duration_seconds) : '—'}
                  label="Driving time"
                />
                {conditions.terrain && (
                  <>
                    <GlanceTile
                      icon="trending-up"
                      tint="#F97316"
                      value={`${Math.round(conditions.terrain.total_ascent_m).toLocaleString()} m`}
                      label="Total climb"
                    />
                    <GlanceTile
                      icon="trending-down"
                      tint="#14B8A6"
                      value={`${Math.round(conditions.terrain.total_descent_m).toLocaleString()} m`}
                      label="Total descent"
                    />
                  </>
                )}
              </View>
            </View>
          </View>

          <ModalDialog
            visible={chartOpen}
            title="Route Terrain & Elevation"
            subtitle="Hover or drag along the chart to read the height at any point."
            maxWidth={1100}
            onClose={() => setChartOpen(false)}>
            <ElevationChart points={conditions.elevation_profile} height={440} />
          </ModalDialog>
        </>
      )}
    </WizardStepScreen>
  );
}

/**
 * Weather right now at the starting point.
 */
function CurrentWeather({
  place,
  latitude,
  longitude,
  unit,
}: {
  place: string;
  latitude: number;
  longitude: number;
  unit: TemperatureUnit;
}) {
  const colors = useTheme();
  const key = `${latitude},${longitude}`;
  const [result, setResult] = useState<{
    key: string;
    data: CurrentConditions | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentConditions(latitude, longitude)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null });
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setResult({ key, data: null, error: errorMessage(fetchError) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, latitude, longitude]);

  const current = result?.key === key ? result : null;
  const now = current?.data;

  return (
    <View
      style={[
        styles.panel,
        styles.current,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement },
      ]}>
      <View style={styles.currentMain}>
        {now ? (
          <WeatherIcon code={now.weather_code} size={64} />
        ) : (
          <View style={styles.currentIconPlaceholder}>
            {!current && <ActivityIndicator color={colors.primary} />}
          </View>
        )}
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Weather now in {place}
          </ThemedText>
          {now ? (
            <View style={styles.currentTemperature}>
              <ThemedText style={styles.bigTemperature}>
                {formatTemperature(now.temperature_c, unit)}
              </ThemedText>
              <View>
                <ThemedText type="smallBold">
                  {formatTemperature(now.temperature_min_c, unit, false)} /{' '}
                  {formatTemperature(now.temperature_max_c, unit, false)}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {describeWeather(now.weather_code).label}
                </ThemedText>
              </View>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              {current?.error ? "Current weather isn't available right now." : 'Loading…'}
            </ThemedText>
          )}
        </View>
      </View>

      {now && (
        <View style={styles.currentStats}>
          <CurrentStat
            icon="water"
            tint="#60A5FA"
            label="Rain chance"
            value={`${Math.round(now.precipitation_probability)}%`}
          />
          <CurrentStat
            icon="weather-windy"
            tint="#7DD3FC"
            label="Wind"
            value={`${Math.round(now.wind_speed_kmh)} km/h`}
          />
          <CurrentStat
            icon="road-variant"
            tint={RoadColors[now.road_conditions.level]}
            label="Road conditions"
            value={now.road_conditions.label}
            valueColor={RoadColors[now.road_conditions.level]}
          />
          <CurrentStat
            icon="eye-outline"
            tint="#7DD3FC"
            label="Visibility"
            value={now.visibility ? VisibilityLabels[now.visibility] : '—'}
          />
        </View>
      )}
    </View>
  );
}

function CurrentStat({
  icon,
  tint,
  label,
  value,
  valueColor,
}: {
  icon: IconName;
  tint: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  const colors = useTheme();

  return (
    <View style={[styles.currentStat, { borderLeftColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={26} color={tint} />
      <View>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold" style={valueColor ? { color: valueColor } : undefined}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Amber banner listing what to watch out for, or a green all-clear.
 */
function Warnings({ warnings, partial }: { warnings: string[]; partial: boolean }) {
  const colors = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (warnings.length === 0) {
    return (
      <View style={[styles.banner, styles.clearBanner]}>
        <MaterialCommunityIcons name="check-circle" size={28} color="#22C55E" />
        <ThemedText type="smallBold" style={styles.bannerTitleClear}>
          No weather or road warnings{partial ? ' so far' : ''}
        </ThemedText>
      </View>
    );
  }

  const shown = expanded ? warnings : warnings.slice(0, WarningsPreview);
  const hidden = warnings.length - shown.length;

  return (
    <View accessibilityRole="alert" style={[styles.banner, styles.warningBanner]}>
      <MaterialCommunityIcons name="alert" size={32} color="#F59E0B" />
      <View style={styles.bannerText}>
        <ThemedText type="smallBold" style={styles.bannerTitleWarning}>
          {warnings.length} {warnings.length === 1 ? 'thing' : 'things'} to watch
          out for
        </ThemedText>
        {shown.map((warning) => (
          <ThemedText key={warning} type="small">
            • {warning}
          </ThemedText>
        ))}
      </View>
      {(hidden > 0 || expanded) && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((value) => !value)}
          style={({ hovered }) => [
            styles.bannerButton,
            { borderColor: colors.border, backgroundColor: colors.backgroundElement },
            hovered && { backgroundColor: colors.backgroundSelected },
          ]}>
          <ThemedText type="smallBold">
            {expanded ? 'Show less' : `View all ${warnings.length}`}
          </ThemedText>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'arrow-right'}
            size={16}
            color={colors.text}
          />
        </Pressable>
      )}
    </View>
  );
}

function UnitToggle({
  unit,
  onChange,
}: {
  unit: TemperatureUnit;
  onChange: (unit: TemperatureUnit) => void;
}) {
  const colors = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Temperature unit"
      style={[styles.toggle, { borderColor: colors.border }]}>
      {(['C', 'F'] as const).map((option) => {
        const selected = option === unit;

        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option)}
            style={[styles.toggleOption, selected && { backgroundColor: colors.primary }]}>
            <ThemedText
              type="smallBold"
              style={{ color: selected ? '#FFFFFF' : colors.textSecondary }}>
              °{option}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One place on the route: forecast for the day it's reached.
 */
function CityTile({
  entry,
  number,
  country,
  unit,
}: {
  entry: RoutePointWeather;
  number: number;
  country: string | null;
  unit: TemperatureUnit;
}) {
  const colors = useTheme();
  const date = new Date(`${entry.date}T00:00`);
  const { forecast } = entry;

  const availableFrom = new Date(date);
  availableFrom.setDate(availableFrom.getDate() - (ForecastDays - 1));

  return (
    <View
      style={[
        styles.city,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement },
      ]}>
      <View style={styles.cityHeader}>
        <View style={[styles.cityBadge, { backgroundColor: MarkerColors[entry.kind] }]}>
          <ThemedText type="smallBold" style={styles.cityBadgeText}>
            {number}
          </ThemedText>
        </View>
        <View style={styles.cityName}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {entry.location}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {country ?? ' '}
          </ThemedText>
        </View>
      </View>

      {forecast ? (
        <View style={styles.cityWeather}>
          <WeatherIcon code={forecast.weather_code} size={44} />
          <View>
            <ThemedText type="smallBold" style={styles.cityTemperature}>
              {formatTemperature(forecast.temperature_min_c, unit, false)} /{' '}
              {formatTemperature(forecast.temperature_max_c, unit, false)}
            </ThemedText>
            <View style={styles.cityRain}>
              <MaterialCommunityIcons name="water" size={14} color="#60A5FA" />
              <ThemedText type="small" themeColor="textSecondary">
                {Math.round(forecast.precipitation_probability)}%
              </ThemedText>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.cityWeather}>
          <MaterialCommunityIcons
            name="calendar-clock"
            size={36}
            color={colors.textSecondary}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.cityPending}>
            Forecast from {formatShortDate(availableFrom)}
          </ThemedText>
        </View>
      )}

      <View style={styles.cityDate}>
        <MaterialCommunityIcons name="calendar-month" size={16} color={colors.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {formatShortDate(date)}
        </ThemedText>
      </View>
    </View>
  );
}

function GlanceTile({
  icon,
  tint,
  value,
  label,
}: {
  icon: IconName;
  tint: string;
  value: string;
  label: string;
}) {
  const colors = useTheme();

  return (
    <View style={[styles.glanceTile, { backgroundColor: colors.backgroundSelected }]}>
      <View style={[styles.glanceIcon, { backgroundColor: `${tint}2E` }]}>
        <MaterialCommunityIcons name={icon} size={26} color={tint} />
      </View>
      <View style={styles.glanceText}>
        <ThemedText type="smallBold" style={styles.glanceValue}>
          {value}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      </View>
    </View>
  );
}

function formatTemperature(celsius: number, unit: TemperatureUnit, withUnit = true) {
  const value = unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
  return `${Math.round(value)}°${withUnit ? unit : ''}`;
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  errorBox: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },

  panel: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.three,
  },

  // --- Current weather ---
  current: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },

  currentMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  currentIconPlaceholder: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },

  currentTemperature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  bigTemperature: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '800',
  },

  currentStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.two,
  },

  currentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderLeftWidth: 1,
    minWidth: 150,
  },

  // --- Warnings ---
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },

  warningBanner: {
    borderColor: 'rgba(245, 158, 11, 0.6)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },

  clearBanner: {
    borderColor: 'rgba(34, 197, 94, 0.5)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },

  bannerText: {
    flex: 1,
    minWidth: 220,
    gap: Spacing.half,
  },

  bannerTitleWarning: {
    color: '#F59E0B',
    fontSize: 16,
  },

  bannerTitleClear: {
    color: '#22C55E',
  },

  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  // --- Sections ---
  section: {
    gap: Spacing.three,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  sectionTitle: {
    fontSize: 17,
  },

  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: Spacing.half,
  },

  toggleOption: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },

  // --- City tiles ---
  cities: {
    alignItems: 'stretch',
    paddingBottom: Spacing.two,
  },

  cityArrow: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  city: {
    width: 176,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },

  cityHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },

  cityBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cityBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
  },

  cityName: {
    flex: 1,
    minWidth: 0,
  },

  cityWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
  },

  cityTemperature: {
    fontSize: 17,
  },

  cityRain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },

  cityPending: {
    flex: 1,
  },

  cityDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  // --- Chart + glance ---
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  chartPanel: {
    flexGrow: 2,
    flexBasis: 480,
    minWidth: 0,
  },

  glancePanel: {
    flexGrow: 1,
    flexBasis: 300,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  glanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  glanceTile: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 14,
    padding: Spacing.three,
  },

  glanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  glanceText: {
    flex: 1,
    minWidth: 0,
  },

  glanceValue: {
    fontSize: 17,
  },
});
