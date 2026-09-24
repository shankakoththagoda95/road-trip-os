import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipSelect } from '@/components/form/chip-select';
import { FormField, TextField } from '@/components/form/form-field';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { usesBattery, usesFuel } from '@/constants/vehicles';
import { useTheme } from '@/hooks/use-theme';
import { type BudgetDraft, useTripDraft } from '@/hooks/use-trip-draft';
import { type Currency, CurrencyOptions, estimateBudget } from '@/utils/budget';
import { pluralize } from '@/utils/dates';
import { formatMoney } from '@/utils/numbers';

export default function BudgetStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, updateBudget, completeStep } = useTripDraft();
  const { budget, vehicle, details } = draft;
  const { currency } = budget;

  const estimate = estimateBudget(draft);
  const money = (amount: number) => formatMoney(amount, currency);

  // With no vehicle picked we can't know which applies; ask for fuel only.
  const showFuel = !vehicle || usesFuel(vehicle.fuel_type);
  const showCharging = vehicle !== null && usesBattery(vehicle.fuel_type);

  function field(key: keyof BudgetDraft) {
    return {
      value: budget[key],
      onChangeText: (value: string) => updateBudget({ [key]: value }),
      keyboardType: 'decimal-pad' as const,
      placeholder: '0',
    };
  }

  function handleContinue() {
    completeStep('budget');

    const { next } = getTripStep('budget');
    router.navigate(next?.href ?? '/trips/new');
  }

  return (
    <WizardStepScreen stepId="budget" onContinue={handleContinue}>
      <FormField label="Currency">
        <ChipSelect
          options={CurrencyOptions}
          value={currency as Currency}
          onChange={(value) => updateBudget({ currency: value })}
        />
      </FormField>

      {showFuel && (
        <CostSection emoji="⛽" title="Fuel">
          {estimate.fuel ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Your route needs about {Math.round(estimate.fuel.amount)} L
                of fuel.
              </ThemedText>
              <TextField
                label={`Fuel price (${currency} per litre)`}
                {...field('fuelPricePerLiter')}
                hint={
                  estimate.fuel.unitPrice !== null
                    ? `≈ ${money(estimate.fuel.cost)} for the trip`
                    : undefined
                }
              />
            </>
          ) : (
            <TextField
              label={`Fuel cost (${currency})`}
              {...field('fuelCost')}
              hint="Pick a vehicle and plan your route to calculate this."
            />
          )}
        </CostSection>
      )}

      {showCharging && (
        <CostSection emoji="⚡" title="Charging">
          {estimate.electricity ? (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                Your route needs about{' '}
                {Math.round(estimate.electricity.amount)} kWh
                {vehicle?.fuel_type === 'plug_in_hybrid'
                  ? ' (assuming you use the full battery range first)'
                  : ''}
                .
              </ThemedText>
              <TextField
                label={`Electricity price (${currency} per kWh)`}
                {...field('electricityPricePerKwh')}
                hint={
                  estimate.electricity.unitPrice !== null
                    ? `≈ ${money(estimate.electricity.cost)} for the trip`
                    : undefined
                }
              />
            </>
          ) : (
            <TextField
              label={`Charging cost (${currency})`}
              {...field('evChargingCost')}
              hint="Plan your route to calculate this."
            />
          )}
        </CostSection>
      )}

      <CostSection emoji="🍽️" title="Food">
        <TextField
          label={`Per person per day (${currency})`}
          {...field('foodPerPersonPerDay')}
          hint={`× ${pluralize(details.travelers, 'traveler', 'travelers')} × ${pluralize(details.durationDays, 'day', 'days')} = ${money(estimate.foodCost)}`}
        />
      </CostSection>

      <View style={styles.row}>
        <View style={styles.column}>
          <TextField
            label={`🛣️ Tolls (${currency})`}
            {...field('tollCost')}
            hint="Road Fees & Borders estimates these for your route."
          />
        </View>
        <View style={styles.column}>
          <TextField
            label={`🅿️ Parking (${currency})`}
            {...field('parkingCost')}
          />
        </View>
      </View>

      <TextField
        label={`➕ Other (${currency})`}
        {...field('otherCost')}
        hint="Accommodation, activities, ferries…"
      />

      <ThemedView type="backgroundSelected" style={styles.total}>
        <View style={styles.totalHeader}>
          <ThemedText type="smallBold">Estimated total</ThemedText>
          <ThemedText style={styles.totalValue}>
            {money(estimate.total)}
          </ThemedText>
        </View>

        {details.travelers > 1 && estimate.total > 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            ≈ {money(estimate.total / details.travelers)} per person
          </ThemedText>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {(
          [
            ['Fuel', estimate.fuelCost],
            ['Charging', estimate.evChargingCost],
            ['Food', estimate.foodCost],
            ['Tolls', estimate.tollCost],
            ['Parking', estimate.parkingCost],
            ['Other', estimate.otherCost],
          ] as const
        )
          .filter(([, value]) => value > 0)
          .map(([label, value]) => (
            <View key={label} style={styles.breakdownRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {label}
              </ThemedText>
              <ThemedText type="small">{money(value)}</ThemedText>
            </View>
          ))}
      </ThemedView>
    </WizardStepScreen>
  );
}

function CostSection({
  emoji,
  title,
  children,
}: PropsWithChildren<{ emoji: string; title: string }>) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {emoji} {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },

  sectionTitle: {
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

  total: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
  },

  totalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  totalValue: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
  },

  divider: {
    height: 1,
  },

  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
