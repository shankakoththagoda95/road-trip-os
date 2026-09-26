import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { listVehicles, type Vehicle } from '@/api/vehicles';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { VehicleForm } from '@/components/vehicles/vehicle-form';
import { VehicleIcon } from '@/components/vehicles/vehicle-icon';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import {
  fuelTypeLabel,
  vehicleMakeModel,
  vehicleRangeKm,
} from '@/constants/vehicles';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import { currentRoutePreview } from '@/utils/route-draft';
import { formatDistance } from '@/utils/units';

type VehiclesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; vehicles: Vehicle[] };

export default function VehicleStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, setVehicle, completeStep } = useTripDraft();
  const routePreview = currentRoutePreview(draft);
  const routeKm = routePreview ? routePreview.distance_meters / 1000 : null;

  const [state, setState] = useState<VehiclesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listVehicles()
      .then((vehicles) => {
        if (!cancelled) {
          setState({ status: 'loaded', vehicles });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: 'error', message: errorMessage(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const vehicles = state.status === 'loaded' ? state.vehicles : [];
  // With no vehicles yet, go straight to the form.
  const formOpen =
    showForm || (state.status === 'loaded' && vehicles.length === 0);

  function handleCreated(vehicle: Vehicle) {
    setState({ status: 'loaded', vehicles: [...vehicles, vehicle] });
    setVehicle(vehicle);
    setShowForm(false);
  }

  function handleContinue() {
    if (draft.vehicle) {
      completeStep('vehicle');
    }

    const { next } = getTripStep('vehicle');
    router.navigate(next?.href ?? '/trips/new');
  }

  return (
    <WizardStepScreen
      stepId="vehicle"
      onContinue={handleContinue}
      continueLabel={draft.vehicle ? undefined : 'Skip for now'}>
      {state.status === 'loading' && (
        <ActivityIndicator color={colors.primary} />
      )}

      {state.status === 'error' && (
        <View style={styles.message}>
          <ThemedText type="small" themeColor="danger">
            {state.message}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}>
            <ThemedText type="linkPrimary">Try again</ThemedText>
          </Pressable>
        </View>
      )}

      {vehicles.length > 0 && (
        <View accessibilityRole="radiogroup" style={styles.list}>
          {vehicles.map((vehicle) => (
            <VehicleOption
              key={vehicle.id}
              vehicle={vehicle}
              routeKm={routeKm}
              selected={draft.vehicle?.id === vehicle.id}
              onSelect={() => setVehicle(vehicle)}
            />
          ))}
        </View>
      )}

      {state.status === 'loaded' &&
        (formOpen ? (
          <VehicleForm
            onSaved={handleCreated}
            onCancel={vehicles.length > 0 ? () => setShowForm(false) : undefined}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowForm(true)}
            style={({ pressed }) => [
              styles.addButton,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold" themeColor="primary">
              + Add a vehicle
            </ThemedText>
          </Pressable>
        ))}

      {!draft.vehicle && state.status === 'loaded' && vehicles.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          No vehicle selected. You can skip this, but fuel and charging
          planning need one.
        </ThemedText>
      )}
    </WizardStepScreen>
  );
}

function VehicleOption({
  vehicle,
  routeKm,
  selected,
  onSelect,
}: {
  vehicle: Vehicle;
  routeKm: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = useTheme();
  const { fuelKm, electricKm } = vehicleRangeKm(vehicle);
  const rangeKm = (fuelKm ?? 0) + (electricKm ?? 0) || null;
  const isElectric = vehicle.fuel_type === 'electric';

  const specs = [
    fuelTypeLabel(vehicle.fuel_type),
    vehicle.fuel_consumption && `${vehicle.fuel_consumption} L/100 km`,
    vehicle.tank_capacity && `${vehicle.tank_capacity} L tank`,
    vehicle.energy_consumption && `${vehicle.energy_consumption} kWh/100 km`,
    vehicle.battery_capacity && `${vehicle.battery_capacity} kWh battery`,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={vehicle.name}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected
            ? colors.backgroundSelected
            : colors.backgroundElement,
        },
        pressed && styles.pressed,
      ]}>
      <VehicleIcon type={vehicle.vehicle_type} size={44} />

      <View style={styles.optionText}>
        <ThemedText type="smallBold" style={styles.optionName}>
          {vehicle.name}
          {vehicleMakeModel(vehicle) ? (
            <ThemedText type="small" themeColor="textSecondary">
              {'  '}
              {vehicleMakeModel(vehicle)}
            </ThemedText>
          ) : null}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {specs.join(' · ')}
        </ThemedText>

        {rangeKm !== null && (
          <ThemedText type="small" themeColor="textSecondary">
            Range ≈ {formatDistance(rangeKm * 1000)}
            {routeKm !== null &&
              ` · ${rangeSummary(routeKm, rangeKm, isElectric)}`}
          </ThemedText>
        )}
      </View>

      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.primary : colors.border },
        ]}>
        {selected && (
          <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />
        )}
      </View>
    </Pressable>
  );
}

// e.g. "fits on one charge" / "about 2 fuel stops".
function rangeSummary(routeKm: number, rangeKm: number, isElectric: boolean) {
  const stops = Math.ceil(routeKm / rangeKm) - 1;
  const noun = isElectric ? 'charging' : 'fuel';

  if (stops <= 0) {
    return isElectric ? 'fits on one charge' : 'fits on one tank';
  }

  return `about ${stops} ${noun} stop${stops === 1 ? '' : 's'}`;
}

const styles = StyleSheet.create({
  message: {
    gap: Spacing.two,
  },

  list: {
    gap: Spacing.two,
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
  },

  optionText: {
    flex: 1,
    gap: Spacing.half,
  },

  optionName: {
    fontSize: 16,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  addButton: {
    height: 52,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: {
    opacity: 0.8,
  },
});
