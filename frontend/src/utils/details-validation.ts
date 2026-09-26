import type { TripDetailsDraft } from '@/hooks/use-trip-draft';
import { toLocalDateTimeString } from '@/utils/dates';

export type DetailsErrors = Partial<Record<keyof TripDetailsDraft, string>>;

/**
 * What's missing or wrong in Trip Details; empty when the trip can be
 * created. Shared by the Trip Details step and the Trip Summary.
 */
export function validateDetails(details: TripDetailsDraft): DetailsErrors {
  const errors: DetailsErrors = {};

  if (!details.name.trim()) {
    errors.name = 'Give your trip a name.';
  }

  if (!details.startLocation.trim()) {
    errors.startLocation = 'Where does the trip start?';
  }

  if (details.stops.every((stop) => !stop.trim())) {
    errors.stops = 'Add at least one stop.';
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
