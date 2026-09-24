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
) -> tuple[list[DrivingDay], list[str]]:
    """
    Split legs into driving days and place them on trip days.

    `day_number` is the day of the trip (1 = departure day). One-way trips
    drive on consecutive days from the start. Round trips drive out first
    and back at the end, leaving free days in between.

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
    )

    return route, days
