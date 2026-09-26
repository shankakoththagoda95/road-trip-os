import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import {
  createVehicle,
  type FuelType,
  updateVehicle,
  type Vehicle,
  type VehicleType,
} from '@/api/vehicles';
import { ChipSelect } from '@/components/form/chip-select';
import { FormField, TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  FuelTypeOptions,
  usesBattery,
  usesFuel,
  VehicleTypeOptions,
} from '@/constants/vehicles';
import { useTheme } from '@/hooks/use-theme';
import { parseNumber } from '@/utils/numbers';

type VehicleFormValues = {
  name: string;
  brand: string;
  model: string;
  vehicle_type: VehicleType;
  fuel_type: FuelType;
  fuel_consumption: string;
  tank_capacity: string;
  energy_consumption: string;
  battery_capacity: string;
};

type VehicleFormErrors = Partial<Record<keyof VehicleFormValues, string>>;

const emptyForm: VehicleFormValues = {
  name: '',
  brand: '',
  model: '',
  vehicle_type: 'car',
  fuel_type: 'petrol',
  fuel_consumption: '',
  tank_capacity: '',
  energy_consumption: '',
  battery_capacity: '',
};

function toFormValues(vehicle: Vehicle): VehicleFormValues {
  const text = (value: number | null) => (value === null ? '' : String(value));

  return {
    name: vehicle.name,
    brand: vehicle.brand ?? '',
    model: vehicle.model ?? '',
    vehicle_type: vehicle.vehicle_type as VehicleType,
    fuel_type: vehicle.fuel_type as FuelType,
    fuel_consumption: text(vehicle.fuel_consumption),
    tank_capacity: text(vehicle.tank_capacity),
    energy_consumption: text(vehicle.energy_consumption),
    battery_capacity: text(vehicle.battery_capacity),
  };
}

/**
 * Add a vehicle, or edit one when `vehicle` is given. Only asks for the
 * numbers the fuel type needs (tank & consumption, and/or battery & energy
 * use), because fuel and charging planning depend on them.
 */
export function VehicleForm({
  vehicle,
  title = vehicle ? 'Edit vehicle' : 'Add a vehicle',
  framed = true,
  onSaved,
  onCancel,
}: {
  vehicle?: Vehicle;
  title?: string;
  // False inside a popup, which provides its own border and title.
  framed?: boolean;
  onSaved: (vehicle: Vehicle) => void;
  onCancel?: () => void;
}) {
  const colors = useTheme();
  const [form, setForm] = useState<VehicleFormValues>(() =>
    vehicle ? toFormValues(vehicle) : emptyForm,
  );
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsFuel = usesFuel(form.fuel_type);
  const needsBattery = usesBattery(form.fuel_type);

  function update<K extends keyof VehicleFormValues>(field: K) {
    return (value: VehicleFormValues[K]) => {
      setForm((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  function validate() {
    const next: VehicleFormErrors = {};

    if (!form.name.trim()) {
      next.name = 'Give the vehicle a name.';
    }

    const required: (keyof VehicleFormValues)[] = [
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

    const data = {
      name: form.name.trim(),
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
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
    };

    try {
      onSaved(
        vehicle
          ? await updateVehicle(vehicle.id, data)
          : await createVehicle(data),
      );
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
    <View
      style={[
        styles.fields,
        framed && [styles.framed, { borderColor: colors.border }],
      ]}>
      {framed && (
        <View style={styles.formHeader}>
          <ThemedText type="smallBold" style={styles.formTitle}>
            {title}
          </ThemedText>
          {onCancel && (
            <Pressable accessibilityRole="button" onPress={onCancel}>
              <ThemedText type="linkPrimary">Cancel</ThemedText>
            </Pressable>
          )}
        </View>
      )}

      <TextField
        label="Name"
        placeholder="e.g. Family Volvo"
        value={form.name}
        onChangeText={update('name')}
        error={errors.name}
        hint="What you call it, shown on your trips."
      />

      <View style={styles.row}>
        <View style={styles.column}>
          <TextField
            label="Brand (optional)"
            placeholder="e.g. Volvo"
            value={form.brand}
            onChangeText={update('brand')}
            error={errors.brand}
            maxLength={60}
          />
        </View>
        <View style={styles.column}>
          <TextField
            label="Model (optional)"
            placeholder="e.g. XC90"
            value={form.model}
            onChangeText={update('model')}
            error={errors.model}
            maxLength={60}
          />
        </View>
      </View>

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
        label={vehicle ? 'Save changes' : 'Save vehicle'}
        onPress={handleSave}
        loading={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: Spacing.three,
  },

  framed: {
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
});
