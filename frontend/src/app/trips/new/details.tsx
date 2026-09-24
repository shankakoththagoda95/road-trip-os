import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateInput } from '@/components/form/date-input';
import { FormField, TextField } from '@/components/form/form-field';
import { SegmentedControl } from '@/components/form/segmented-control';
import { Stepper } from '@/components/form/stepper';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import {
  type TripDetailsDraft,
  type TripType,
  useTripDraft,
} from '@/hooks/use-trip-draft';
import {
  formatShortDate,
  toLocalDateTimeString,
  tripEndDate,
} from '@/utils/dates';

const TripTypeOptions: readonly { value: TripType; label: string }[] = [
  { value: 'one_way', label: 'One way' },
  { value: 'round_trip', label: 'Round trip' },
];

type DetailsErrors = Partial<Record<keyof TripDetailsDraft, string>>;

export default function TripDetailsScreen() {
  const router = useRouter();
  const { draft, updateDetails, completeStep } = useTripDraft();
  const details = draft.details;

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

  return (
    <WizardStepScreen stepId="details" onContinue={handleContinue}>
      <TextField
        label="Trip Name"
        placeholder="e.g. Scandinavian Adventure"
        value={details.name}
        onChangeText={(name) => updateDetails({ name })}
        error={errors.name}
      />

      <FormField label="Trip Type">
        <SegmentedControl
          options={TripTypeOptions}
          value={details.tripType}
          onChange={(tripType) => updateDetails({ tripType })}
        />
      </FormField>

      <View style={styles.row}>
        <View style={styles.column}>
          <TextField
            label="Starting Location"
            placeholder="e.g. Stockholm"
            value={details.startLocation}
            onChangeText={(startLocation) => updateDetails({ startLocation })}
            error={errors.startLocation}
          />
        </View>

        <View style={styles.column}>
          <TextField
            label="Destination"
            placeholder="e.g. Oslo"
            value={details.destination}
            onChangeText={(destination) => updateDetails({ destination })}
            error={errors.destination}
            hint={
              details.tripType === 'round_trip' && details.startLocation
                ? `You'll return to ${details.startLocation} at the end.`
                : undefined
            }
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.column}>
          <FormField label="Departure Date" error={errors.departureDate}>
            <DateInput
              mode="date"
              accessibilityLabel="Departure Date"
              value={details.departureDate}
              min={toDateString(new Date())}
              onChange={(departureDate) => updateDetails({ departureDate })}
              hasError={Boolean(errors.departureDate)}
            />
          </FormField>
        </View>

        <View style={styles.column}>
          <FormField label="Departure Time" error={errors.departureTime}>
            <DateInput
              mode="time"
              accessibilityLabel="Departure Time"
              value={details.departureTime}
              onChange={(departureTime) => updateDetails({ departureTime })}
              hasError={Boolean(errors.departureTime)}
            />
          </FormField>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.column}>
          <FormField
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
          </FormField>
        </View>

        <View style={styles.column}>
          <FormField label="Travelers">
            <Stepper
              label="Travelers"
              value={details.travelers}
              min={1}
              max={50}
              unit={(count) => (count === 1 ? 'person' : 'people')}
              onChange={(travelers) => updateDetails({ travelers })}
            />
          </FormField>
        </View>
      </View>
    </WizardStepScreen>
  );
}

function validateDetails(details: TripDetailsDraft): DetailsErrors {
  const errors: DetailsErrors = {};

  if (!details.name.trim()) {
    errors.name = 'Give your trip a name.';
  }

  if (!details.startLocation.trim()) {
    errors.startLocation = 'Where does the trip start?';
  }

  if (!details.destination.trim()) {
    errors.destination = 'Where are you heading?';
  }

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(details.departureDate);
  const validTime = /^\d{2}:\d{2}$/.test(details.departureTime);

  if (!validDate) {
    errors.departureDate = 'Pick a departure date.';
  }

  if (!validTime) {
    errors.departureTime = 'Pick a departure time.';
  }

  if (validDate && validTime) {
    const departure = new Date(
      toLocalDateTimeString(details.departureDate, details.departureTime),
    );

    if (Number.isNaN(departure.getTime())) {
      errors.departureDate = 'That date is not valid.';
    } else if (departure.getTime() <= Date.now()) {
      errors.departureDate = 'Departure must be in the future.';
    }
  }

  return errors;
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  column: {
    flexGrow: 1,
    flexBasis: 240,
  },
});
