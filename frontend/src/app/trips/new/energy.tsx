import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { type EnergyStop, planEnergyStops } from '@/api/routes';
import { FormField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { Stepper } from '@/components/form/stepper';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { RouteMap } from '@/components/route-map/route-map';
import { type MapPoint, MarkerColors } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { vehicleRangeKm } from '@/constants/vehicles';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import {
  buildEnergyRequest,
  currentEnergyPlan,
  energyKey,
  energyMode,
} from '@/utils/energy-draft';
import { currentRoutePreview } from '@/utils/route-draft';
import { formatDistance } from '@/utils/units';

const percent = () => '%';

export default function EnergyStepScreen() {
  const router = useRouter();
  const { draft, updateEnergy, completeStep } = useTripDraft();
  const { vehicle, energy } = draft;

  const routePreview = currentRoutePreview(draft);
  const request = buildEnergyRequest(draft);
  const plan = currentEnergyPlan(draft);

  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    completeStep('energy');

    const { next } = getTripStep('energy');
    router.navigate(next?.href ?? '/trips/new');
  }

  async function findStops() {
    if (!request) {
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const data = await planEnergyStops(request);
      updateEnergy({ plan: { key: energyKey(request), data } });
    } catch (searchError) {
      setError(errorMessage(searchError));
    } finally {
      setSearching(false);
    }
  }

  // --- Missing prerequisites ---
  if (!vehicle || !routePreview) {
    return (
      <WizardStepScreen stepId="energy" onContinue={handleContinue}>
        <Prerequisite
          done={Boolean(routePreview)}
          title="Plan your route"
          href="/trips/new/route"
        />
        <Prerequisite
          done={Boolean(vehicle)}
          title="Choose a vehicle"
          href="/trips/new/vehicle"
        />
        <ThemedText type="small" themeColor="textSecondary">
          Fuel and charging stops are planned from your route and your
          vehicle&apos;s range. You can skip this step for now.
        </ThemedText>
      </WizardStepScreen>
    );
  }

  const mode = energyMode(vehicle);
  const isEv = mode === 'ev';
  const { fuelKm, electricKm } = vehicleRangeKm(vehicle);
  const rangeKm = isEv ? electricKm : fuelKm;

  if (rangeKm === null) {
    return (
      <WizardStepScreen stepId="energy" onContinue={handleContinue}>
        <ThemedText type="smallBold">
          {vehicle.name} is missing range details
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {isEv
            ? 'Add its battery size and energy use to plan charging stops.'
            : 'Add its tank size and fuel consumption to plan fuel stops.'}
        </ThemedText>
      </WizardStepScreen>
    );
  }

  const stopKind = isEv ? 'charge' : 'fuel';
  const mapPoints: MapPoint[] = [
    ...routePreview.points.map((point) => ({
      label: point.location,
      latitude: point.latitude,
      longitude: point.longitude,
      kind: point.kind,
    })),
    ...(plan?.stops ?? []).map((stop, index) => ({
      label: `${isEv ? '⚡' : '⛽'} ${index + 1}. ${stop.station?.name ?? 'No station found'}`,
      latitude: stop.station?.latitude ?? stop.latitude,
      longitude: stop.station?.longitude ?? stop.longitude,
      kind: stopKind as MapPoint['kind'],
    })),
  ];

  return (
    <WizardStepScreen stepId="energy" onContinue={handleContinue}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.headerTitle}>
          {isEv ? '⚡ Charging' : '⛽ Fuel'} stops for {vehicle.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Full range ≈ {formatDistance(rangeKm * 1000)} · route{' '}
          {formatDistance(routePreview.distance_meters)}
          {vehicle.fuel_type === 'plug_in_hybrid' && electricKm
            ? ` · plus ≈ ${formatDistance(electricKm * 1000)} electric at the start`
            : ''}
        </ThemedText>
      </View>

      <View style={styles.row}>
        <View style={styles.column}>
          <FormField label={isEv ? 'Battery when leaving' : 'Tank when leaving'}>
            <Stepper
              label="Starting level"
              value={energy.startLevelPercent}
              min={10}
              max={100}
              step={10}
              unit={percent}
              onChange={(startLevelPercent) =>
                updateEnergy({ startLevelPercent })
              }
            />
          </FormField>
        </View>

        <View style={styles.column}>
          <FormField
            label="Keep in reserve"
            hint="Stops are planned before you dip into this.">
            <Stepper
              label="Reserve"
              value={energy.reservePercent}
              min={5}
              max={40}
              step={5}
              unit={percent}
              onChange={(reservePercent) => updateEnergy({ reservePercent })}
            />
          </FormField>
        </View>

        {isEv && (
          <View style={styles.column}>
            <FormField
              label="Charge to"
              hint="Charging above ~80% is much slower.">
              <Stepper
                label="Charge to"
                value={energy.chargeToPercent}
                min={50}
                max={100}
                step={10}
                unit={percent}
                onChange={(chargeToPercent) =>
                  updateEnergy({ chargeToPercent })
                }
              />
            </FormField>
          </View>
        )}
      </View>

      {!plan && (
        <PrimaryButton
          label={isEv ? 'Find charging stops' : 'Find fuel stops'}
          onPress={findStops}
          loading={searching}
        />
      )}

      {searching && (
        <ThemedText type="small" themeColor="textSecondary">
          Searching for stations along your route. This can take a few
          seconds…
        </ThemedText>
      )}

      {error && (
        <ThemedView
          type="backgroundSelected"
          accessibilityRole="alert"
          style={styles.notice}>
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        </ThemedView>
      )}

      <RouteMap points={mapPoints} line={routePreview.geometry.coordinates} />

      {plan && (
        <View style={styles.results}>
          {plan.stops.length === 0 ? (
            <ThemedView type="backgroundSelected" style={styles.notice}>
              <ThemedText type="smallBold">✅ No stops needed</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Your {isEv ? 'battery' : 'tank'} covers the whole route with
                {` ${energy.reservePercent}%`} to spare.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <ThemedText type="smallBold">
                {plan.stops.length} {isEv ? 'charging' : 'fuel'}{' '}
                {plan.stops.length === 1 ? 'stop' : 'stops'}
              </ThemedText>
              {plan.stops.map((stop, index) => (
                <StopRow
                  key={index}
                  stop={stop}
                  number={index + 1}
                  color={MarkerColors[stopKind]}
                />
              ))}
            </>
          )}

          {plan.warnings.map((warning) => (
            <ThemedText key={warning} type="small" themeColor="warning">
              ⚠️ {warning}
            </ThemedText>
          ))}
        </View>
      )}
    </WizardStepScreen>
  );
}

function StopRow({
  stop,
  number,
  color,
}: {
  stop: EnergyStop;
  number: number;
  color: string;
}) {
  const colors = useTheme();
  const { station } = stop;

  return (
    <View style={[styles.stopRow, { borderColor: colors.border }]}>
      <View style={[styles.stopBadge, { backgroundColor: color }]}>
        <ThemedText style={styles.stopBadgeText}>{number}</ThemedText>
      </View>

      <View style={styles.stopText}>
        <ThemedText type="smallBold">
          {station?.name ?? 'No station found nearby'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          At km {Math.round(stop.distance_from_start_km)}
          {stop.distance_from_route_km !== null &&
            ` · ${stop.distance_from_route_km.toFixed(1)} km off route`}
        </ThemedText>
        {station && station.details.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {station.details.join(' · ')}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

function Prerequisite({
  done,
  title,
  href,
}: {
  done: boolean;
  title: string;
  href: Href;
}) {
  const router = useRouter();

  return (
    <View style={styles.prerequisite}>
      <ThemedText type="smallBold">
        {done ? '✅' : '⬜'} {title}
      </ThemedText>
      {!done && (
        <Pressable accessibilityRole="link" onPress={() => router.navigate(href)}>
          <ThemedText type="linkPrimary">Go →</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.half,
  },

  headerTitle: {
    fontSize: 18,
  },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  column: {
    flexGrow: 1,
    flexBasis: 200,
  },

  notice: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },

  results: {
    gap: Spacing.two,
  },

  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  stopBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  stopBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  stopText: {
    flex: 1,
    gap: Spacing.half,
  },

  prerequisite: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
