from app.schemas.route import RoutePreference
from app.schemas.trip import TripType
from app.services.geocoding import geocode_location
from app.services.routing import calculate_multi_stop_route


def resolve_location(location: str) -> tuple[float, float]:
    """
    Convert a text location into coordinates.
    """

    return geocode_location(location)


def build_route_coordinates(
    start_coordinates: tuple[float, float],
    destination_coordinates: tuple[float, float],
    stop_coordinates: list[tuple[float, float]],
    trip_type: TripType,
) -> list[tuple[float, float]]:
    """
    Build an ordered list of coordinates for a trip.

    Order:
    start → stops → destination
    """

    coordinates = [
        start_coordinates,
        *stop_coordinates,
        destination_coordinates,
    ]

    if trip_type == TripType.ROUND_TRIP:
        coordinates.append(start_coordinates)

    return coordinates


def calculate_trip_route(
    start_coordinates: tuple[float, float],
    destination_coordinates: tuple[float, float],
    stop_coordinates: list[tuple[float, float]],
    preference: RoutePreference,
    trip_type: TripType,
) -> dict:
    """
    Build and calculate a complete trip route.
    """

    coordinates = build_route_coordinates(
        start_coordinates,
        destination_coordinates,
        stop_coordinates,
        trip_type,
    )

    return calculate_multi_stop_route(
        coordinates,
        preference,
    )