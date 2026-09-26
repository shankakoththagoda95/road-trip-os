from dataclasses import replace

from app.models.trip import Trip
from app.models.trip_destination import TripDestination
from app.schemas.route import RoutePreference
from app.services.route_builder import (
    calculate_trip_route,
    resolve_location,
)
from app.services.route_constraints import (
    DrivingDay,
    split_route_into_days,
)


def schedule_driving_days(
    legs: list[dict],
    trip_type: str,
    duration_days: int,
    max_distance_per_day: float | None,
    max_driving_hours_per_day: float | None,
    stay_nights: list[int] | None = None,
) -> tuple[list[DrivingDay], list[str]]:
    """
    Split legs into driving days and place them on trip days.

    `day_number` is the day of the trip (1 = departure day). One-way trips
    drive on consecutive days from the start. Round trips drive out first
    and back at the end, leaving free days in between.

    `stay_nights` (one per leg: nights at the place the leg ends) plans the
    trip around the traveller's stays instead: after arriving somewhere for
    N nights, driving continues N days later. Places with 0 nights are
    driven through. Round trips still drive home on the last day(s).

    Returns the days and warnings (e.g. more driving days than the trip
    has). Raises ValueError when a single leg exceeds a daily limit, since
    days can only be split at stops.
    """

    warnings: list[str] = []

    def split(part: list[dict]) -> list[DrivingDay]:
        return split_route_into_days(
            part,
            max_distance_per_day,
            max_driving_hours_per_day,
        )

    if stay_nights and any(stay_nights):
        days = _schedule_around_stays(
            legs, stay_nights, trip_type, duration_days, split
        )
        last_day = max((day.day_number for day in days), default=0)

        if last_day > duration_days:
            warnings.append(
                f"Your stays and driving need {last_day} days but the trip "
                f"is {duration_days} "
                f"{'day' if duration_days == 1 else 'days'} long"
            )

        return days, warnings

    if trip_type == "round_trip" and len(legs) >= 2:
        outbound = split(legs[:-1])
        homebound = split(legs[-1:])
        driving_days = len(outbound) + len(homebound)

        if driving_days <= duration_days:
            first_return_day = duration_days - len(homebound) + 1

            days = [
                replace(day, day_number=index + 1)
                for index, day in enumerate(outbound)
            ] + [
                replace(day, day_number=first_return_day + index)
                for index, day in enumerate(homebound)
            ]

            return days, warnings

        days = [
            replace(day, day_number=index + 1)
            for index, day in enumerate(outbound + homebound)
        ]
    else:
        days = split(legs)
        driving_days = len(days)

    if driving_days > duration_days:
        warnings.append(
            f"The driving needs {driving_days} days but the trip is "
            f"{duration_days} "
            f"{'day' if duration_days == 1 else 'days'} long"
        )

    return days, warnings


def _schedule_around_stays(
    legs: list[dict],
    stay_nights: list[int],
    trip_type: str,
    duration_days: int,
    split,
) -> list[DrivingDay]:
    """
    Driving between overnight stays: legs up to each place with nights are
    driven (split by the daily limits), then the trip waits there.
    """

    # One per leg; missing entries mean driving straight on.
    stay_nights = (list(stay_nights) + [0] * len(legs))[: len(legs)]

    days: list[DrivingDay] = []
    day_number = 1
    segment: list[dict] = []
    segments: list[tuple[list[dict], int]] = []

    for leg, nights in zip(legs, stay_nights):
        segment.append(leg)

        if nights > 0:
            segments.append((segment, nights))
            segment = []

    homebound = segment

    for part, nights in segments:
        for day in split(part):
            days.append(replace(day, day_number=day_number))
            day_number += 1

        # Arrived on day_number - 1; drive on after the last night.
        day_number += nights - 1

    if homebound:
        home_days = split(homebound)

        # Round trips keep any spare days at the last stay, then drive home
        # at the end of the trip.
        if trip_type == "round_trip":
            day_number = max(day_number, duration_days - len(home_days) + 1)

        for day in home_days:
            days.append(replace(day, day_number=day_number))
            day_number += 1

    return days


def generate_itinerary_days(
    trip: Trip,
    destinations: list[TripDestination],
):
    start_coordinates = resolve_location(
        trip.start_location
    )

    destination_coordinates = resolve_location(
        trip.destination
    )

    stop_coordinates = []

    for destination in destinations:
        if (
            destination.latitude is None
            or destination.longitude is None
        ):
            raise ValueError(
                f"Destination '{destination.location}' "
                "does not have valid coordinates"
            )

        stop_coordinates.append(
            (
                destination.latitude,
                destination.longitude,
            )
        )

    route = calculate_trip_route(
        start_coordinates,
        destination_coordinates,
        stop_coordinates,
        RoutePreference.FASTEST,
        trip.trip_type,
    )

    locations = [
        trip.start_location,
        *[
            destination.location
            for destination in destinations
        ],
        trip.destination,
    ]

    if trip.trip_type == "round_trip":
        locations.append(trip.start_location)

    legs = [
        {
            "from_location": locations[index],
            "to_location": locations[index + 1],
            "distance_meters": leg["distance_meters"],
            "duration_seconds": leg["duration_seconds"],
        }
        for index, leg in enumerate(route["legs"])
    ]

    days, _ = schedule_driving_days(
        legs,
        trip.trip_type,
        trip.duration_days,
        trip.max_distance_per_day,
        trip.max_driving_hours_per_day,
        stay_nights=saved_stay_nights(trip, destinations),
    )

    return route, days


def saved_stay_nights(
    trip: Trip,
    destinations: list[TripDestination],
) -> list[int]:
    """
    Nights at the end of each leg of a saved trip (see stay_nights in
    services/route_preview.py).
    """

    nights = [destination.nights or 0 for destination in destinations] + [
        trip.destination_nights or 0
    ]

    if trip.trip_type == "round_trip":
        nights.append(0)

    return nights
