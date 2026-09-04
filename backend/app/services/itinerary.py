from app.models.trip import Trip
from app.models.trip_destination import TripDestination
from app.schemas.route import RoutePreference
from app.services.route_builder import (
    calculate_trip_route,
    resolve_location,
)
from app.services.route_constraints import split_route_into_days


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

    days = split_route_into_days(
        legs,
        trip.max_distance_per_day,
        trip.max_driving_hours_per_day,
    )

    return route, days