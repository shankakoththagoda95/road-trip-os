import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { getRouteConditions, type RoutePointWeather } from '@/api/routes';
import { ElevationProfile } from '@/components/elevation-profile';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { MarkerColors } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
import { describeWeather } from '@/utils/weather';

// Open-Meteo daily forecasts reach 16 days ahead.
const ForecastDays = 16;

export default function ConditionsStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, setConditions, completeStep } = useTripDraft();

  const request = buildConditionsRequest(draft);
  const requestKey = request ? conditionsKey(request) : null;
  const conditions = currentConditions(draft);
  const hasConditions = conditions !== null;

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

  return (
    <WizardStepScreen stepId="conditions" onContinue={handleContinue}>
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

      {conditions && (
        <>
          <ThemedView type="backgroundSelected" style={styles.box}>
            {conditions.warnings.length > 0 ? (
              <>
                <ThemedText type="smallBold">
                  ⚠️ {conditions.warnings.length}{' '}
                  {conditions.warnings.length === 1 ? 'thing' : 'things'} to
                  watch out for
                </ThemedText>
                {conditions.warnings.map((warning) => (
                  <ThemedText key={warning} type="small">
                    • {warning}
                  </ThemedText>
                ))}
              </>
            ) : (
              <ThemedText type="smallBold">
                ✅ No weather or road warnings
                {conditions.weather.some((entry) => !entry.forecast_available)
                  ? ' so far'
                  : ''}
              </ThemedText>
            )}
          </ThemedView>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              🌦️ Weather along the way
            </ThemedText>
            {conditions.weather.map((entry, index) => (
              <WeatherRow key={index} entry={entry} />
            ))}
            {conditions.unavailable.includes('weather') && (
              <ThemedText type="small" themeColor="warning">
                Some forecasts couldn&apos;t be loaded. Try again later.
              </ThemedText>
            )}
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              ⛰️ Terrain
            </ThemedText>

            {conditions.terrain ? (
              <>
                <View style={styles.tiles}>
                  <Tile
                    label="Total climb"
                    value={`${Math.round(conditions.terrain.total_ascent_m)} m`}
                  />
                  <Tile
                    label="Total descent"
                    value={`${Math.round(conditions.terrain.total_descent_m)} m`}
                  />
                  <Tile
                    label="Highest point"
                    value={`${Math.round(conditions.terrain.max_elevation_m)} m`}
                  />
                  <Tile
                    label="Lowest point"
                    value={`${Math.round(conditions.terrain.min_elevation_m)} m`}
                  />
                </View>
                <ElevationProfile points={conditions.elevation_profile} />
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Elevation data is unavailable right now.
              </ThemedText>
            )}
          </View>
        </>
      )}
    </WizardStepScreen>
  );
}

function WeatherRow({ entry }: { entry: RoutePointWeather }) {
  const colors = useTheme();
  const date = new Date(`${entry.date}T00:00`);
  const { forecast } = entry;
  const weather = forecast ? describeWeather(forecast.weather_code) : null;

  const availableFrom = new Date(date);
  availableFrom.setDate(availableFrom.getDate() - (ForecastDays - 1));

  return (
    <View style={[styles.weatherRow, { borderColor: colors.border }]}>
      <View
        style={[styles.dot, { backgroundColor: MarkerColors[entry.kind] }]}
      />

      <View style={styles.weatherPlace}>
        <ThemedText type="smallBold">{entry.location}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatShortDate(date)}
        </ThemedText>
      </View>

      {forecast && weather ? (
        <View style={styles.weatherValues}>
          <ThemedText type="smallBold">
            {weather.emoji} {Math.round(forecast.temperature_max_c)}° /{' '}
            {Math.round(forecast.temperature_min_c)}°
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {weather.label} · 💧 {Math.round(forecast.precipitation_probability)}%
            · 💨 {Math.round(forecast.wind_speed_max_kmh)} km/h
          </ThemedText>
        </View>
      ) : (
        <ThemedText
          type="small"
          themeColor="textSecondary"
          style={styles.weatherValues}>
          Forecast from {formatShortDate(availableFrom)}
        </ThemedText>
      )}
    </View>
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

  section: {
    gap: Spacing.two,
  },

  sectionTitle: {
    fontSize: 16,
  },

  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  weatherPlace: {
    flex: 1,
    minWidth: 0,
  },

  weatherValues: {
    alignItems: 'flex-end',
    textAlign: 'right',
    flexShrink: 1,
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
});
