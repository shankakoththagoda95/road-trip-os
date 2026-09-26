from app.models.trip import Trip
from app.services.tolls import TollCalculation, TollProvider, calculate_route_tolls
from app.models.trip_destination import TripDestination
from app.schemas.route import RoutePreference
from app.schemas.trip import TripType
from app.services.route_builder import (
    calculate_trip_route,
    resolve_location,
)
from app.services.itinerary import saved_stay_nights, schedule_driving_days
from app.services.itinerary_preview import legs_over_limit
from app.services.route_constraints import check_distance_limit
from app.services.borders import (
    BorderCalculation,
    BorderProvider,
    calculate_route_borders,
)
from app.services.travel_checklist import (
    TravelChecklist,
    generate_travel_checklist,
)


def calculate_trip_route_details(
    trip: Trip,
    destinations: list[TripDestination],
    preference: RoutePreference,
) -> dict:
    """
    Calculate a trip route and split it into driving days.
    """

    start_coordinates = resolve_location(
        trip.start_location
    )

    destination_coordinates = resolve_location(
        trip.destination
    )

    for destination in destinations:
        if (
            destination.latitude is None
            or destination.longitude is None
        ):
            raise ValueError(
                f"Destination '{destination.location}' "
                "does not have valid coordinates"
            )

    stop_coordinates = [
        (destination.latitude, destination.longitude)
        for destination in destinations
    ]

    route = calculate_trip_route(
        start_coordinates,
        destination_coordinates,
        stop_coordinates,
        preference,
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

    if trip.trip_type == TripType.ROUND_TRIP:
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

    # Same scheduling as the planner: round trips drive home at the end.
    # A leg longer than a day's limit can't be split (days end at stops),
    # so report it instead of failing the whole route.
    try:
        days, problems = schedule_driving_days(
            legs,
            trip.trip_type,
            trip.duration_days,
            trip.max_distance_per_day,
            trip.max_driving_hours_per_day,
            stay_nights=saved_stay_nights(trip, destinations),
        )
    except ValueError:
        days = []
        problems = legs_over_limit(
            legs,
            trip.max_distance_per_day,
            trip.max_driving_hours_per_day,
        )

    points = [
        {
            "location": trip.start_location,
            "latitude": start_coordinates[0],
            "longitude": start_coordinates[1],
            "kind": "start",
        },
        *[
            {
                "location": destination.location,
                "latitude": destination.latitude,
                "longitude": destination.longitude,
                "kind": "stop",
            }
            for destination in destinations
        ],
        {
            "location": trip.destination,
            "latitude": destination_coordinates[0],
            "longitude": destination_coordinates[1],
            "kind": "destination",
        },
    ]

    return {
        "route": route,
        "locations": locations,
        "legs": legs,
        "days": days,
        "points": points,
        "problems": problems,
    }


def calculate_trip_route_tolls(
    trip: Trip,
    destinations: list[TripDestination],
    preference: RoutePreference,
    provider: TollProvider,
    currency: str,
) -> TollCalculation:
    route_details = calculate_trip_route_details(
        trip=trip,
        destinations=destinations,
        preference=preference,
    )

    route_coordinates = route_details["route"]["geometry"]["coordinates"]

    return calculate_route_tolls(
        route_coordinates=route_coordinates,
        provider=provider,
        currency=currency,
    )


def calculate_trip_route_borders(
    trip: Trip,
    destinations: list[TripDestination],
    preference: RoutePreference,
    provider: BorderProvider,
) -> BorderCalculation:
    route_details = calculate_trip_route_details(
        trip=trip,
        destinations=destinations,
        preference=preference,
    )

    route_coordinates = route_details["route"]["geometry"]["coordinates"]

    return calculate_route_borders(
        route_coordinates=route_coordinates,
        provider=provider,
    )


def calculate_trip_travel_checklist(
    trip: Trip,
    destinations: list[TripDestination],
    preference: RoutePreference,
    provider: BorderProvider,
) -> TravelChecklist:
    border_result = calculate_trip_route_borders(
        trip=trip,
        destinations=destinations,
        preference=preference,
        provider=provider,
    )

    return generate_travel_checklist(
        countries=border_result.countries,
    )