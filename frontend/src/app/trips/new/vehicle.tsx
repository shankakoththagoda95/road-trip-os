import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import {
  createVehicle,
  type FuelType,
  listVehicles,
  type Vehicle,
  type VehicleType,
} from '@/api/vehicles';
import { ChipSelect } from '@/components/form/chip-select';
import { FormField, TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import {
  FuelTypeOptions,
  fuelTypeLabel,
  usesBattery,
  usesFuel,
  vehicleEmoji,
  vehicleRangeKm,
  VehicleTypeOptions,
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
      continueLabel={draft.vehicle ? 'Continue' : 'Skip for now'}>
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
          <AddVehicleForm
            onCreated={handleCreated}
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
      <ThemedText style={styles.optionEmoji}>
        {vehicleEmoji(vehicle.vehicle_type)}
      </ThemedText>

      <View style={styles.optionText}>
        <ThemedText type="smallBold" style={styles.optionName}>
          {vehicle.name}
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

type VehicleForm = {
  name: string;
  vehicle_type: VehicleType;
  fuel_type: FuelType;
  fuel_consumption: string;
  tank_capacity: string;
  energy_consumption: string;
  battery_capacity: string;
};

type VehicleFormErrors = Partial<Record<keyof VehicleForm, string>>;

const emptyForm: VehicleForm = {
  name: '',
  vehicle_type: 'car',
  fuel_type: 'petrol',
  fuel_consumption: '',
  tank_capacity: '',
  energy_consumption: '',
  battery_capacity: '',
};

// Accepts "6,5" as well as "6.5". Returns null for empty / invalid input.
function parseNumber(text: string) {
  const value = Number.parseFloat(text.replace(',', '.'));

  return Number.isFinite(value) ? value : null;
}

function AddVehicleForm({
  onCreated,
  onCancel,
}: {
  onCreated: (vehicle: Vehicle) => void;
  onCancel?: () => void;
}) {
  const colors = useTheme();
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsFuel = usesFuel(form.fuel_type);
  const needsBattery = usesBattery(form.fuel_type);

  function update<K extends keyof VehicleForm>(field: K) {
    return (value: VehicleForm[K]) => {
      setForm((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function validate() {
    const next: VehicleFormErrors = {};

    if (!form.name.trim()) {
      next.name = 'Give the vehicle a name.';
    }

    const required: (keyof VehicleForm)[] = [
      ...(needsFuel ? (['fuel_consumption', 'tank_capacity'] as const) : []),
      ...(needsBattery
        ? (['energy_consumption', 'battery_capacity'] as const)
        : []),
    ];

    for (const field of required) {
      const value = parseNumber(form[field]);

      if (value === null || value <= 0) {
        next[field] = 'Enter a number greater than 0.';
      }
    }

    return next;
  }

  async function handleSave() {
    const validationErrors = validate();
    setErrors(validationErrors);
    setFormError(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const vehicle = await createVehicle({
        name: form.name.trim(),
        vehicle_type: form.vehicle_type,
        fuel_type: form.fuel_type,
        fuel_consumption: needsFuel ? parseNumber(form.fuel_consumption) : null,
        tank_capacity: needsFuel ? parseNumber(form.tank_capacity) : null,
        energy_consumption: needsBattery
          ? parseNumber(form.energy_consumption)
          : null,
        battery_capacity: needsBattery
          ? parseNumber(form.battery_capacity)
          : null,
      });

      onCreated(vehicle);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(errorMessage(error));
      }

      setSaving(false);
    }
  }

  return (
    <View style={[styles.form, { borderColor: colors.border }]}>
      <View style={styles.formHeader}>
        <ThemedText type="smallBold" style={styles.formTitle}>
          Add a vehicle
        </ThemedText>
        {onCancel && (
          <Pressable accessibilityRole="button" onPress={onCancel}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
        )}
      </View>

      <TextField
        label="Name"
        placeholder="e.g. Family Volvo"
        value={form.name}
        onChangeText={update('name')}
        error={errors.name}
      />

      <FormField label="Type">
        <ChipSelect
          options={VehicleTypeOptions}
          value={form.vehicle_type}
          onChange={update('vehicle_type')}
        />
      </FormField>

      <FormField label="Fuel">
        <ChipSelect
          options={FuelTypeOptions}
          value={form.fuel_type}
          onChange={update('fuel_type')}
        />
      </FormField>

      {needsFuel && (
        <View style={styles.row}>
          <View style={styles.column}>
            <TextField
              label="Fuel consumption (L/100 km)"
              placeholder="e.g. 6.5"
              keyboardType="decimal-pad"
              value={form.fuel_consumption}
              onChangeText={update('fuel_consumption')}
              error={errors.fuel_consumption}
            />
          </View>
          <View style={styles.column}>
            <TextField
              label="Tank size (L)"
              placeholder="e.g. 55"
              keyboardType="decimal-pad"
              value={form.tank_capacity}
              onChangeText={update('tank_capacity')}
              error={errors.tank_capacity}
            />
          </View>
        </View>
      )}

      {needsBattery && (
        <View style={styles.row}>
          <View style={styles.column}>
            <TextField
              label="Energy use (kWh/100 km)"
              placeholder="e.g. 17"
              keyboardType="decimal-pad"
              value={form.energy_consumption}
              onChangeText={update('energy_consumption')}
              error={errors.energy_consumption}
            />
          </View>
          <View style={styles.column}>
            <TextField
              label="Battery size (kWh)"
              placeholder="e.g. 75"
              keyboardType="decimal-pad"
              value={form.battery_capacity}
              onChangeText={update('battery_capacity')}
              error={errors.battery_capacity}
            />
          </View>
        </View>
      )}

      {formError && (
        <ThemedText type="small" themeColor="danger">
          {formError}
        </ThemedText>
      )}

      <PrimaryButton
        label="Save vehicle"
        onPress={handleSave}
        loading={saving}
      />
    </View>
  );
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

  optionEmoji: {
    fontSize: 30,
    lineHeight: 38,
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

  form: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
  },

  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  formTitle: {
    fontSize: 16,
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

  pressed: {
    opacity: 0.8,
  },
});
