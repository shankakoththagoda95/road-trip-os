import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentProps, type PropsWithChildren, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { DateInput } from '@/components/form/date-input';
import { inputStyle, withoutSidePadding } from '@/components/form/form-field';
import { Stepper } from '@/components/form/stepper';
import { DayPlan } from '@/components/new-trip/day-plan';
import { PlannerFrame } from '@/components/new-trip/planner-frame';
import { RouteStopsSection } from '@/components/new-trip/route-stops-section';
import { ThemedText } from '@/components/themed-text';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  type TripDetailsDraft,
  type TripType,
  useTripDraft,
} from '@/hooks/use-trip-draft';
import { formatShortDate, tripEndDate } from '@/utils/dates';
import { validateDetails } from '@/utils/details-validation';
import { currentRoutePreview, routeParts } from '@/utils/route-draft';
import { planStays } from '@/utils/stays';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Icon tile colours for each field.
const Tints = {
  blue: '#2563EB',
  green: '#16A34A',
  purple: '#7C3AED',
  orange: '#EA580C',
} as const;

const TripTypeOptions: readonly {
  value: TripType;
  label: string;
  description: string;
  icon: IconName;
}[] = [
  {
    value: 'one_way',
    label: 'One way',
    description: 'Ends at your last stop',
    icon: 'paper-plane-outline',
  },
  {
    value: 'round_trip',
    label: 'Round trip',
    description: 'Drives back to the start',
    icon: 'sync-outline',
  },
];

export default function TripDetailsScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, updateDetails, rememberPlace, completeStep } = useTripDraft();
  const details = draft.details;

  // `?destination=` from search or the dashboard becomes the first stop
  // when no stops are filled in yet.
  const { destination: suggestedDestination } = useLocalSearchParams<{
    destination?: string;
  }>();
  const noStops = details.stops.every((stop) => !stop.trim());

  useEffect(() => {
    if (suggestedDestination && noStops) {
      updateDetails({ stops: [suggestedDestination] });
    }
    // Only when arriving with a new suggestion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedDestination]);

  // Only show errors once the user has tried to continue.
  const [showErrors, setShowErrors] = useState(false);
  const errors = showErrors ? validateDetails(details) : {};

  function handleContinue() {
    if (Object.keys(validateDetails(details)).length > 0) {
      setShowErrors(true);
      return;
    }

    completeStep('details');

    const { next } = getTripStep('details');
    router.navigate(next?.href ?? '/trips/new');
  }

  const endDate = formatEndDate(details.departureDate, details.durationDays);
  const stayPlan = planStays(details);

  return (
    <PlannerFrame
      stepId="details"
      onNext={handleContinue}
      showArt
      summary={<JourneySummary details={details} />}>
      <View style={styles.grid}>
        <FieldTile
          icon="calendar-outline"
          tint={Tints.blue}
          label="Departure Date"
          error={errors.departureDate}>
          <DateInput
            mode="date"
            accessibilityLabel="Departure Date"
            value={details.departureDate}
            min={toDateString(new Date())}
            onChange={(departureDate) => updateDetails({ departureDate })}
            hasError={Boolean(errors.departureDate)}
          />
        </FieldTile>

        <FieldTile
          icon="time-outline"
          tint={Tints.blue}
          label="Departure Time"
          error={errors.departureTime}>
          <DateInput
            mode="time"
            accessibilityLabel="Departure Time"
            value={details.departureTime}
            onChange={(departureTime) => updateDetails({ departureTime })}
            hasError={Boolean(errors.departureTime)}
          />
        </FieldTile>

        <FieldTile
          icon="hourglass-outline"
          tint={Tints.green}
          label="Duration"
          hint={endDate ? `Ends ${endDate}` : undefined}>
          <Stepper
            label="Duration"
            value={details.durationDays}
            min={1}
            max={365}
            unit={(days) => (days === 1 ? 'day' : 'days')}
            onChange={(durationDays) => updateDetails({ durationDays })}
          />
        </FieldTile>

        <FieldTile icon="people-outline" tint={Tints.purple} label="Travelers">
          <Stepper
            label="Travelers"
            value={details.travelers}
            min={1}
            max={50}
            unit={(count) => (count === 1 ? 'person' : 'people')}
            onChange={(travelers) => updateDetails({ travelers })}
          />
        </FieldTile>

        <FieldTile
          icon="pricetag-outline"
          tint={Tints.purple}
          label="Trip Name"
          error={errors.name}
          wide>
          <View style={styles.nameField}>
            <TextInput
              accessibilityLabel="Trip Name"
              placeholder="e.g. Scandinavian Adventure"
              placeholderTextColor={colors.textSecondary}
              value={details.name}
              onChangeText={(name) => updateDetails({ name })}
              style={[
                withoutSidePadding(inputStyle(colors, Boolean(errors.name))),
                styles.nameInput,
              ]}
            />
            {details.name.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear trip name"
                onPress={() => updateDetails({ name: '' })}
                style={styles.clearName}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </FieldTile>

        <FieldTile icon="swap-horizontal" tint={Tints.orange} label="Trip Type" wide>
          <View style={styles.typeRow}>
            {TripTypeOptions.map((option) => {
              const selected = details.tripType === option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => updateDetails({ tripType: option.value })}
                  style={({ hovered }) => [
                    styles.typeOption,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected
                        ? 'rgba(37, 99, 235, 0.08)'
                        : colors.backgroundElement,
                    },
                    hovered && !selected && { backgroundColor: colors.backgroundSelected },
                  ]}>
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={selected ? colors.primary : colors.textSecondary}
                  />
                  <View style={styles.typeText}>
                    <ThemedText
                      type="smallBold"
                      style={selected && { color: colors.primary }}>
                      {option.label}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {option.description}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={selected ? colors.primary : colors.border}
                  />
                </Pressable>
              );
            })}
          </View>
        </FieldTile>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <RouteStopsSection
        startLocation={details.startLocation}
        stops={details.stops}
        tripType={details.tripType}
        places={draft.route.places}
        onChangeStart={(startLocation) => updateDetails({ startLocation })}
        onChangeStops={(stops) => updateDetails({ stops })}
        rememberPlace={rememberPlace}
        startError={errors.startLocation}
        stopsError={errors.stops}
        stayNights={details.stayNights}
        onChangeStayNights={(stayNights) => updateDetails({ stayNights })}
      />

      {stayPlan && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <DayPlan
            plan={stayPlan}
            legs={currentRoutePreview(draft)?.legs}
            roundTrip={details.tripType === 'round_trip'}
            onSetDuration={(durationDays) => updateDetails({ durationDays })}
          />
        </>
      )}

      {showErrors && Object.keys(errors).length > 0 && (
        <View
          accessibilityRole="alert"
          style={[styles.errorBox, { borderColor: colors.danger }]}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <ThemedText type="small" themeColor="danger">
            Fill in the highlighted fields to continue.
          </ThemedText>
        </View>
      )}
    </PlannerFrame>
  );
}

/**
 * A field with a coloured icon tile beside its label.
 */
function FieldTile({
  icon,
  tint,
  label,
  hint,
  error,
  wide = false,
  children,
}: PropsWithChildren<{
  icon: IconName;
  tint: string;
  label: string;
  hint?: string;
  error?: string;
  wide?: boolean;
}>) {
  const colors = useTheme();

  return (
    <View style={[styles.tile, wide && styles.wideTile]}>
      <View style={styles.tileHeader}>
        <View style={[styles.tileIcon, { backgroundColor: `${tint}1F` }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <ThemedText type="smallBold" style={styles.tileLabel}>
          {label}
        </ThemedText>
        {hint && (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        )}
      </View>
      {children}
      {error && (
        <ThemedText type="small" style={{ color: colors.danger }}>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * "One way: A → B → C" and where the trip ends, for the footer.
 */
function JourneySummary({ details }: { details: TripDetailsDraft }) {
  const colors = useTheme();
  const { start, stops, destination } = routeParts(details);
  const roundTrip = details.tripType === 'round_trip';

  if (!start || !destination) {
    return (
      <View style={styles.summaryRow}>
        <Ionicons name="map-outline" size={22} color={colors.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          Add a starting point and at least one stop to see your journey.
        </ThemedText>
      </View>
    );
  }

  const path = [start, ...stops, ...(roundTrip ? [start] : [])].join(' → ');

  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryIcon, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
        <Ionicons
          name={roundTrip ? 'sync' : 'paper-plane'}
          size={18}
          color={colors.primary}
        />
      </View>
      <View style={styles.summaryText}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {roundTrip ? 'Round trip' : 'One way'}: {path}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {roundTrip
            ? `After ${destination}, the route returns to ${start}.`
            : `The trip ends in ${destination}.`}
        </ThemedText>
      </View>
    </View>
  );
}

function toDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

// Last day of the trip, e.g. "Fri, 3 Oct", or null without a valid start date.
function formatEndDate(departureDate: string, durationDays: number) {
  const start = new Date(`${departureDate}T00:00`);

  if (Number.isNaN(start.getTime())) {
    return null;
  }

  return formatShortDate(tripEndDate(start, durationDays));
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },

  // Two per row on wide screens, one on narrow ones.
  tile: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 220,
    gap: Spacing.two,
  },

  wideTile: {
    flexBasis: '100%',
  },

  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tileLabel: {
    flex: 1,
  },

  nameField: {
    justifyContent: 'center',
  },

  nameInput: {
    paddingLeft: Spacing.four,
    paddingRight: Spacing.five + Spacing.two,
  },

  clearName: {
    position: 'absolute',
    right: Spacing.three,
  },

  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  typeOption: {
    flexGrow: 1,
    flexBasis: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  typeText: {
    flex: 1,
  },

  divider: {
    height: 1,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryText: {
    flex: 1,
  },
});
