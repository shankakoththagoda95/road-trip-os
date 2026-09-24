import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { getRouteFees, type RoadFee, type RoadFeeKind } from '@/api/routes';
import { ExternalLink } from '@/components/external-link';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { RouteMap } from '@/components/route-map/route-map';
import type { MapPoint } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import { buildFeesRequest, currentFees, feesKey } from '@/utils/fees-draft';
import { formatMoney } from '@/utils/numbers';
import { currentRoutePreview } from '@/utils/route-draft';

const FeeKindLabels: Record<RoadFeeKind, string> = {
  vignette: 'Vignette',
  distance: 'Motorway tolls',
  toll_stations: 'Toll stations',
  crossing: 'Bridge / tunnel',
  info: 'Good to know',
};

const euros = (amount: number) => formatMoney(amount, 'EUR');

export default function FeesStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, setFees, updateBudget, completeStep } = useTripDraft();

  const request = buildFeesRequest(draft);
  const requestKey = request ? feesKey(request) : null;
  const fees = currentFees(draft);
  const hasFees = fees !== null;
  const routePreview = currentRoutePreview(draft);

  // Retrying bumps this so the effect runs again.
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(
    null,
  );
  const failureKey = `${requestKey}:${attempt}`;
  const error = failure?.key === failureKey ? failure.message : null;

  useEffect(() => {
    if (!requestKey || hasFees) {
      return;
    }

    let cancelled = false;

    getRouteFees(JSON.parse(requestKey))
      .then((data) => {
        if (!cancelled) {
          setFees({ key: requestKey, data });
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
  }, [requestKey, hasFees, failureKey, setFees]);

  function handleContinue() {
    completeStep('fees');

    const { next } = getTripStep('fees');
    router.navigate(next?.href ?? '/trips/new');
  }

  if (!request) {
    return (
      <WizardStepScreen stepId="fees" onContinue={handleContinue}>
        <ThemedText type="smallBold">Plan your route first</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Road fees and border crossings are worked out from your route.
        </ThemedText>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/trips/new/route')}>
          <ThemedText type="linkPrimary">Go to Route & Destinations →</ThemedText>
        </Pressable>
      </WizardStepScreen>
    );
  }

  const budgetInEuros = draft.budget.currency === 'EUR';
  const budgetTolls = Number.parseFloat(draft.budget.tollCost) || 0;
  const tollsInBudget =
    fees !== null && budgetInEuros && budgetTolls === fees.total_eur;

  const mapPoints: MapPoint[] = [
    ...(routePreview?.points ?? []).map((point) => ({
      label: point.location,
      latitude: point.latitude,
      longitude: point.longitude,
      kind: point.kind,
    })),
    ...(fees?.crossings ?? []).map((crossing) => ({
      label: `🛂 ${crossing.from_country} → ${crossing.to_country}`,
      latitude: crossing.latitude,
      longitude: crossing.longitude,
      kind: 'border' as const,
    })),
  ];

  return (
    <WizardStepScreen stepId="fees" onContinue={handleContinue}>
      {!fees && !error && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Checking countries and road fees along your route…
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

      {fees && (
        <>
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              🌍 Countries
            </ThemedText>
            <View style={styles.countries}>
              {fees.countries.map((country, index) => (
                <View key={country.code} style={styles.countryItem}>
                  {index > 0 && (
                    <ThemedText type="small" themeColor="textSecondary">
                      →
                    </ThemedText>
                  )}
                  <ThemedView type="backgroundSelected" style={styles.countryChip}>
                    <ThemedText type="smallBold">{country.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {Math.round(country.distance_km)} km
                    </ThemedText>
                  </ThemedView>
                </View>
              ))}
            </View>
          </View>

          {routePreview && (
            <RouteMap
              points={mapPoints}
              line={routePreview.geometry.coordinates}
              height={260}
            />
          )}

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              🛂 Border crossings
            </ThemedText>
            {fees.crossings.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No borders to cross: the whole route is in{' '}
                {fees.countries[0]?.name ?? 'one country'}.
              </ThemedText>
            ) : (
              fees.crossings.map((crossing, index) => (
                <View
                  key={index}
                  style={[styles.row, { borderColor: colors.border }]}>
                  <ThemedText type="smallBold" style={styles.rowTitle}>
                    {crossing.from_country} → {crossing.to_country}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    at km {Math.round(crossing.distance_from_start_km)}
                  </ThemedText>
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              🛣️ Road fees
            </ThemedText>

            {fees.fees.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No road fees expected on this route.
              </ThemedText>
            ) : (
              fees.fees.map((fee, index) => <FeeRow key={index} fee={fee} />)
            )}

            {fees.notes.map((note) => (
              <ThemedText key={note} type="small" themeColor="warning">
                ⚠️ {note}
              </ThemedText>
            ))}
          </View>

          <ThemedView type="backgroundSelected" style={styles.box}>
            <View style={styles.totalRow}>
              <ThemedText type="smallBold">Estimated road fees</ThemedText>
              <ThemedText style={styles.totalValue}>
                ≈ {euros(fees.total_eur)}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Approximate 2025 prices for a car up to 3.5 t. Check the
              official sites before you travel.
            </ThemedText>

            {fees.total_eur > 0 &&
              (budgetInEuros ? (
                tollsInBudget ? (
                  <ThemedText type="small" themeColor="success">
                    ✓ Added to your Trip Budget as tolls.
                  </ThemedText>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      updateBudget({ tollCost: String(fees.total_eur) })
                    }>
                    <ThemedText type="linkPrimary">
                      Use {euros(fees.total_eur)} as your toll budget
                    </ThemedText>
                  </Pressable>
                )
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  Your budget is in {draft.budget.currency}: convert this
                  amount and add it under Tolls in Trip Budget.
                </ThemedText>
              ))}
          </ThemedView>
        </>
      )}
    </WizardStepScreen>
  );
}

function FeeRow({ fee }: { fee: RoadFee }) {
  const colors = useTheme();

  return (
    <View style={[styles.fee, { borderColor: colors.border }]}>
      <View style={styles.feeHeader}>
        <View style={styles.feeTitle}>
          <ThemedText type="small" themeColor="textSecondary">
            {fee.country_code} · {FeeKindLabels[fee.kind]}
          </ThemedText>
          <ThemedText type="smallBold">{fee.name}</ThemedText>
        </View>
        {fee.amount_eur !== null && (
          <ThemedText type="smallBold">≈ {euros(fee.amount_eur)}</ThemedText>
        )}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {fee.note}
      </ThemedText>

      {fee.url && (
        <ExternalLink href={fee.url as Href & string}>
          <ThemedText type="linkPrimary">Official site ↗</ThemedText>
        </ExternalLink>
      )}
    </View>
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

  countries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },

  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  countryChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  rowTitle: {
    flex: 1,
  },

  fee: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  feeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  feeTitle: {
    flex: 1,
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  totalValue: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
  },
});
