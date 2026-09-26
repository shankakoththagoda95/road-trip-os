import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';

import { AmountStepper } from '@/components/form/amount-stepper';
import { PlannerFrame } from '@/components/new-trip/planner-frame';
import { ThemedText } from '@/components/themed-text';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { usesBattery, usesFuel } from '@/constants/vehicles';
import { useTheme } from '@/hooks/use-theme';
import { type BudgetDraft, useTripDraft } from '@/hooks/use-trip-draft';
import {
  type Currency,
  CurrencyOptions,
  estimateBudget,
  typicalPrices,
} from '@/utils/budget';
import { pluralize } from '@/utils/dates';
import { formatMoney, parseNumber } from '@/utils/numbers';

const panelImage = require('@/assets/images/brand/budget-panel.jpg');

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Icon colours per cost type.
const Tints = {
  currency: '#F59E0B',
  fuel: '#EF4444',
  charging: '#F59E0B',
  food: '#A855F7',
  tolls: '#10B981',
  parking: '#3B82F6',
  other: '#8B5CF6',
  total: '#22C55E',
} as const;

export default function BudgetStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, updateBudget, completeStep } = useTripDraft();
  const { budget, vehicle, details } = draft;
  const { currency } = budget;

  const estimate = estimateBudget(draft);
  const money = (amount: number) => formatMoney(amount, currency);
  const symbol = currencySymbol(currency);

  // With no vehicle picked we can't know which applies; ask for fuel only.
  const showFuel = !vehicle || usesFuel(vehicle.fuel_type);
  const showCharging = vehicle !== null && usesBattery(vehicle.fuel_type);

  const presets = typicalPrices(draft);
  const canUseTypical = Object.keys(presets).length > 0;

  function amountProps(key: keyof BudgetDraft) {
    return {
      value: budget[key],
      onChange: (value: string) => updateBudget({ [key]: value }),
    };
  }

  function handleContinue() {
    completeStep('budget');

    const { next } = getTripStep('budget');
    router.navigate(next?.href ?? '/trips/new');
  }

  const tripLength = `${pluralize(details.travelers, 'traveler', 'travelers')} × ${pluralize(details.durationDays, 'day', 'days')}`;
  const fuelPrice = parseNumber(budget.fuelPricePerLiter);
  const electricityPrice = parseNumber(budget.electricityPricePerKwh);
  const foodPrice = parseNumber(budget.foodPerPersonPerDay);

  // Rows for the breakdown panel, in the same order as the cards.
  const breakdown: BreakdownRow[] = [
    ...(showFuel
      ? [
          {
            key: 'fuel',
            icon: 'gas-station' as const,
            tint: Tints.fuel,
            label: 'Fuel',
            detail:
              estimate.fuel && fuelPrice !== null
                ? `${Math.round(estimate.fuel.amount)} L × ${formatPrice(fuelPrice, currency)}`
                : undefined,
            amount: estimate.fuelCost,
          },
        ]
      : []),
    ...(showCharging
      ? [
          {
            key: 'charging',
            icon: 'ev-station' as const,
            tint: Tints.charging,
            label: 'Charging',
            detail:
              estimate.electricity && electricityPrice !== null
                ? `${Math.round(estimate.electricity.amount)} kWh × ${formatPrice(electricityPrice, currency)}`
                : undefined,
            amount: estimate.evChargingCost,
          },
        ]
      : []),
    {
      key: 'food',
      icon: 'silverware-fork-knife',
      tint: Tints.food,
      label: 'Food',
      detail:
        foodPrice !== null ? `${tripLength} × ${money(foodPrice)}` : undefined,
      amount: estimate.foodCost,
    },
    {
      key: 'tolls',
      icon: 'highway',
      tint: Tints.tolls,
      label: 'Tolls',
      amount: estimate.tollCost,
    },
    {
      key: 'parking',
      icon: 'parking',
      tint: Tints.parking,
      label: 'Parking',
      amount: estimate.parkingCost,
    },
    {
      key: 'other',
      icon: 'plus',
      tint: Tints.other,
      label: 'Other',
      amount: estimate.otherCost,
    },
  ];

  return (
    <PlannerFrame
      stepId="budget"
      onNext={handleContinue}
      summary={
        <TotalSummary
          total={money(estimate.total)}
          perPerson={
            details.travelers > 1 && estimate.total > 0
              ? money(estimate.total / details.travelers)
              : null
          }
        />
      }
      aside={
        <BreakdownPanel
          rows={breakdown}
          total={money(estimate.total)}
          forWhom={`For ${pluralize(details.travelers, 'traveler', 'travelers')} • ${pluralize(details.durationDays, 'day', 'days')}`}
          money={money}
        />
      }>
      <View
        style={[
          styles.tip,
          { borderColor: colors.border, backgroundColor: colors.backgroundSelected },
        ]}>
        <IconTile icon="lightbulb-on-outline" tint={Tints.currency} size={40} />
        <View style={styles.tipText}>
          <ThemedText type="smallBold">Not sure about the costs?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Fill the empty fields with typical European prices, then adjust
            them to your trip.
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={!canUseTypical}
          onPress={() => updateBudget(presets)}
          style={({ hovered, pressed }) => [
            styles.tipButton,
            { borderColor: colors.primary },
            (hovered || pressed) && { backgroundColor: colors.backgroundElement },
            !canUseTypical && styles.disabled,
          ]}>
          <ThemedText type="smallBold" style={{ color: colors.primary }}>
            {canUseTypical ? 'Use typical prices' : 'All filled in'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.currency}>
        <View style={styles.currencyHeader}>
          <MaterialCommunityIcons
            name="cash-multiple"
            size={22}
            color={Tints.currency}
          />
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Currency
          </ThemedText>
        </View>
        <View style={styles.pills} accessibilityRole="radiogroup">
          {CurrencyOptions.map((option) => {
            const selected = option.value === (currency as Currency);

            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => updateBudget({ currency: option.value })}
                style={({ hovered }) => [
                  styles.pill,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected
                      ? colors.primary
                      : colors.backgroundElement,
                  },
                  hovered && !selected && { backgroundColor: colors.backgroundSelected },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={selected && { color: '#FFFFFF' }}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.grid}>
        {showFuel &&
          (estimate.fuel ? (
            <CostCard
              icon="gas-station"
              tint={Tints.fuel}
              title="Fuel"
              description={`Your route needs about ${Math.round(estimate.fuel.amount)} L of fuel.`}
              label={`Fuel price (${currency} per litre)`}>
              <AmountStepper
                label="Fuel price"
                {...amountProps('fuelPricePerLiter')}
                step={0.05}
                decimals={2}
                unit={`${symbol}/L`}
              />
            </CostCard>
          ) : (
            <CostCard
              icon="gas-station"
              tint={Tints.fuel}
              title={`Fuel (${currency})`}
              description="Pick a vehicle and plan your route to calculate this.">
              <AmountStepper
                label="Fuel cost"
                {...amountProps('fuelCost')}
                step={10}
                unit={symbol}
              />
            </CostCard>
          ))}

        {showCharging &&
          (estimate.electricity ? (
            <CostCard
              icon="ev-station"
              tint={Tints.charging}
              title="Charging"
              description={`Your route needs about ${Math.round(estimate.electricity.amount)} kWh${
                vehicle?.fuel_type === 'plug_in_hybrid'
                  ? ' (using the full battery range first)'
                  : ''
              }.`}
              label={`Electricity price (${currency} per kWh)`}>
              <AmountStepper
                label="Electricity price"
                {...amountProps('electricityPricePerKwh')}
                step={0.05}
                decimals={2}
                unit={`${symbol}/kWh`}
              />
            </CostCard>
          ) : (
            <CostCard
              icon="ev-station"
              tint={Tints.charging}
              title={`Charging (${currency})`}
              description="Plan your route to calculate this.">
              <AmountStepper
                label="Charging cost"
                {...amountProps('evChargingCost')}
                step={10}
                unit={symbol}
              />
            </CostCard>
          ))}

        <CostCard
          icon="silverware-fork-knife"
          tint={Tints.food}
          title="Food"
          description={`Per person per day (${currency})`}
          footnote={
            <View style={styles.footnote}>
              <MaterialCommunityIcons
                name="account-group"
                size={16}
                color={colors.textSecondary}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {tripLength} = {money(estimate.foodCost)}
              </ThemedText>
            </View>
          }>
          <AmountStepper
            label="Food per person per day"
            {...amountProps('foodPerPersonPerDay')}
            step={5}
            unit={`${symbol}/day`}
          />
        </CostCard>

        <CostCard
          icon="highway"
          tint={Tints.tolls}
          title={`Tolls (${currency})`}
          description="Highway and road tolls. Road Fees & Borders can fill this in for your route.">
          <AmountStepper
            label="Tolls"
            {...amountProps('tollCost')}
            step={5}
            unit={currency}
          />
        </CostCard>

        <CostCard
          icon="parking"
          tint={Tints.parking}
          title={`Parking (${currency})`}
          description="City and attraction parking fees.">
          <AmountStepper
            label="Parking"
            {...amountProps('parkingCost')}
            step={5}
            unit={currency}
          />
        </CostCard>

        <CostCard
          icon="plus"
          tint={Tints.other}
          title={`Other (${currency})`}
          description="Accommodation, activities, ferries and more…"
          wide>
          <AmountStepper
            label="Other costs"
            {...amountProps('otherCost')}
            step={50}
            unit={currency}
          />
        </CostCard>
      </View>
    </PlannerFrame>
  );
}

type BreakdownRow = {
  key: string;
  icon: IconName;
  tint: string;
  label: string;
  detail?: string;
  amount: number;
};

function IconTile({
  icon,
  tint,
  size = 48,
}: {
  icon: IconName;
  tint: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.iconTile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.28,
          backgroundColor: `${tint}2E`,
        },
      ]}>
      <MaterialCommunityIcons name={icon} size={size * 0.56} color={tint} />
    </View>
  );
}

function CostCard({
  icon,
  tint,
  title,
  description,
  label,
  footnote,
  wide = false,
  children,
}: PropsWithChildren<{
  icon: IconName;
  tint: string;
  title: string;
  description: string;
  label?: string;
  footnote?: ReactNode;
  wide?: boolean;
}>) {
  const colors = useTheme();

  return (
    <View
      style={[
        styles.card,
        wide && styles.wideCard,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement },
      ]}>
      <View style={styles.cardHeader}>
        <IconTile icon={icon} tint={tint} />
        <View style={styles.cardText}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
          {label && <ThemedText type="smallBold">{label}</ThemedText>}
        </View>
      </View>
      {children}
      {footnote}
    </View>
  );
}

/**
 * Right-hand panel: photo, cost breakdown and the estimated total.
 */
function BreakdownPanel({
  rows,
  total,
  forWhom,
  money,
}: {
  rows: BreakdownRow[];
  total: string;
  forWhom: string;
  money: (amount: number) => string;
}) {
  const colors = useTheme();

  return (
    <View
      style={[
        styles.panel,
        { borderColor: colors.border, backgroundColor: colors.backgroundSelected },
      ]}>
      <ImageBackground
        source={panelImage}
        resizeMode="cover"
        style={styles.panelPhoto}
        imageStyle={styles.panelPhotoImage}>
        <View style={styles.panelBadge}>
          <MaterialCommunityIcons name="calculator-variant" size={26} color="#93C5FD" />
          <View>
            <ThemedText type="smallBold" style={styles.panelBadgeTitle}>
              Estimated for your trip
            </ThemedText>
            <ThemedText type="small" style={styles.panelBadgeText}>
              Based on your inputs and route
            </ThemedText>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.panelBody}>
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          Cost Breakdown
        </ThemedText>

        <View style={[styles.rows, { borderColor: colors.border }]}>
          {rows.map((row, index) => (
            <View
              key={row.key}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              ]}>
              <IconTile icon={row.icon} tint={row.tint} size={36} />
              <View style={styles.rowText}>
                <ThemedText type="smallBold">{row.label}</ThemedText>
                {row.detail && (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {row.detail}
                  </ThemedText>
                )}
              </View>
              <ThemedText
                type="smallBold"
                themeColor={row.amount > 0 ? 'text' : 'textSecondary'}>
                {money(row.amount)}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.total}>
          <IconTile icon="calculator" tint={Tints.total} size={44} />
          <View style={styles.rowText}>
            <ThemedText type="smallBold" style={styles.totalTitle}>
              Estimated total
            </ThemedText>
            <ThemedText type="small" style={styles.totalText}>
              {forWhom}
            </ThemedText>
          </View>
          <ThemedText style={styles.totalValue}>{total}</ThemedText>
        </View>
      </View>
    </View>
  );
}

function TotalSummary({
  total,
  perPerson,
}: {
  total: string;
  perPerson: string | null;
}) {
  return (
    <View style={styles.summary}>
      <IconTile icon="wallet-outline" tint={Tints.total} size={40} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold">Estimated total: {total}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {perPerson
            ? `≈ ${perPerson} per person`
            : 'You can change these amounts any time before creating the trip.'}
        </ThemedText>
      </View>
    </View>
  );
}

// e.g. "€", "kr", "£".
function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat(undefined, { style: 'currency', currency })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}

// Unit prices keep their cents, e.g. "€1.85".
function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const styles = StyleSheet.create({
  tip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },

  tipText: {
    flex: 1,
    minWidth: 200,
  },

  tipButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  disabled: {
    opacity: 0.5,
  },

  currency: {
    gap: Spacing.three,
  },

  currencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  sectionTitle: {
    fontSize: 17,
  },

  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  pill: {
    minWidth: 96,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  card: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 260,
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.three,
  },

  wideCard: {
    flexBasis: '100%',
  },

  cardHeader: {
    flexDirection: 'row',
    gap: Spacing.three,
  },

  cardText: {
    flex: 1,
    gap: Spacing.half,
  },

  cardTitle: {
    fontSize: 17,
  },

  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  footnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  panel: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },

  panelPhoto: {
    height: 230,
    padding: Spacing.three,
  },

  panelPhotoImage: {
    width: '100%',
    height: '100%',
  },

  panelBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: 'rgba(8, 18, 32, 0.72)',
  },

  panelBadgeTitle: {
    color: '#FFFFFF',
  },

  panelBadgeText: {
    color: '#CBD5E1',
  },

  panelBody: {
    padding: Spacing.three,
    gap: Spacing.three,
  },

  rows: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },

  rowText: {
    flex: 1,
    minWidth: 0,
  },

  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    padding: Spacing.three,
    backgroundColor: '#0B3B2A',
    borderWidth: 1,
    borderColor: '#166534',
  },

  totalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
  },

  totalText: {
    color: '#BBF7D0',
  },

  totalValue: {
    color: '#4ADE80',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
