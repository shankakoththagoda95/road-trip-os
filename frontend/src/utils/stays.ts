import type { RoutePointInput, RoutePreviewRequest } from '@/api/routes';
import type { TripDetailsDraft } from '@/hooks/use-trip-draft';
import { placeKey } from '@/utils/place-key';
import { routeParts } from '@/utils/route-draft';

// Longest stay at one place (matches the backend).
export const MaxStayNights = 90;

export function nightsAt(details: TripDetailsDraft, place: string) {
  return details.stayNights[placeKey(place)] ?? 0;
}

/**
 * The request with each stop's nights added (the backend plans the days
 * and weather dates around them). Only non-zero nights are sent.
 */
export function withStayNights<T extends RoutePreviewRequest>(
  request: T,
  details: TripDetailsDraft,
): T {
  const withNights = (point: RoutePointInput): RoutePointInput => {
    const nights = nightsAt(details, point.location);
    return nights > 0 ? { ...point, nights } : point;
  };

  return {
    ...request,
    stops: request.stops.map(withNights),
    destination: withNights(request.destination),
  };
}

export type PlanDay = {
  dayNumber: number;
  // Null without a departure date.
  date: Date | null;
  kind: 'drive' | 'stay';
  // Where the day starts and ends (the same place on stay days).
  from: string;
  to: string;
  // Stops with no nights passed on the way.
  through: string[];
  // Legs driven that day, as indexes into the route's legs.
  legs: number[];
  // Where the night is spent; null on the last day of the trip.
  overnight: string | null;
};

export type StayPlan = {
  days: PlanDay[];
  plannedNights: number;
  // Nights in a trip of `durationDays` days.
  tripNights: number;
  // Days the plan needs (more than the trip when stays don't fit).
  daysNeeded: number;
  // Where unplanned nights end up: the destination on one-way trips, the
  // last stay before driving home on round trips.
  spareNightsAt: string | null;
};

/**
 * Which places the traveller is at on each day, from the nights at each
 * stop. Mirrors the backend's scheduling without daily driving limits
 * (the Itinerary step applies those).
 */
export function planStays(details: TripDetailsDraft): StayPlan | null {
  const { start, stops } = routeParts(details);

  if (!start || stops.length === 0) {
    return null;
  }

  const roundTrip = details.tripType === 'round_trip';
  const arrivals = roundTrip ? [...stops, start] : stops;
  const nights = arrivals.map((place, index) =>
    roundTrip && index === arrivals.length - 1 ? 0 : nightsAt(details, place),
  );
  const duration = details.durationDays;

  // Driving days as [day number, first leg, last leg].
  const drives: [number, number, number][] = [];

  if (!nights.some((count) => count > 0)) {
    if (roundTrip) {
      drives.push([1, 0, arrivals.length - 2]);
      drives.push([Math.max(2, duration), arrivals.length - 1, arrivals.length - 1]);
    } else {
      drives.push([1, 0, arrivals.length - 1]);
    }
  } else {
    let day = 1;
    let first = 0;

    nights.forEach((count, index) => {
      if (count > 0) {
        drives.push([day, first, index]);
        // Arrive that day, drive on after the last night.
        day += count;
        first = index + 1;
      }
    });

    if (first < arrivals.length) {
      if (roundTrip) {
        day = Math.max(day, duration);
      }
      drives.push([day, first, arrivals.length - 1]);
    }
  }

  const plannedNights = nights.reduce((sum, count) => sum + count, 0);
  // The last driving day, or the morning after the last planned night.
  const daysNeeded = Math.max(
    ...drives.map(([day]) => day),
    plannedNights > 0 ? plannedNights + 1 : 1,
  );
  const lastDay = Math.max(duration, daysNeeded);
  const departure = details.departureDate
    ? new Date(`${details.departureDate}T00:00`)
    : null;
  const validDeparture = departure && !Number.isNaN(departure.getTime()) ? departure : null;

  const byDay = new Map(drives.map((drive) => [drive[0], drive]));
  const days: PlanDay[] = [];
  let here = start;

  for (let dayNumber = 1; dayNumber <= lastDay; dayNumber++) {
    const date = validDeparture ? new Date(validDeparture) : null;
    date?.setDate(date.getDate() + dayNumber - 1);

    const drive = byDay.get(dayNumber);
    const lastOfTrip = dayNumber === lastDay;

    if (drive) {
      const [, firstLeg, lastLeg] = drive;
      const to = arrivals[lastLeg];
      days.push({
        dayNumber,
        date,
        kind: 'drive',
        from: here,
        to,
        through: arrivals.slice(firstLeg, lastLeg),
        legs: range(firstLeg, lastLeg),
        overnight: lastOfTrip ? null : to,
      });
      here = to;
    } else {
      days.push({
        dayNumber,
        date,
        kind: 'stay',
        from: here,
        to: here,
        through: [],
        legs: [],
        overnight: lastOfTrip ? null : here,
      });
    }
  }

  const lastStayIndex = nights.reduce(
    (found, count, index) => (count > 0 ? index : found),
    -1,
  );

  return {
    days,
    plannedNights,
    tripNights: duration - 1,
    daysNeeded,
    spareNightsAt: roundTrip
      ? lastStayIndex >= 0
        ? arrivals[lastStayIndex]
        : (stops.at(-1) ?? null)
      : (stops.at(-1) ?? null),
  };
}

function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}
