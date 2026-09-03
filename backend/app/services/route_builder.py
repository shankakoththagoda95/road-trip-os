from app.schemas.route import RoutePreference
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
) -> list[tuple[float, float]]:
    """
    Build an ordered list of coordinates for a trip.

    Order:
    start → stops → destination
    """

    return [
        start_coordinates,
        *stop_coordinates,
        destination_coordinates,
    ]


def calculate_trip_route(
    start_coordinates: tuple[float, float],
    destination_coordinates: tuple[float, float],
    stop_coordinates: list[tuple[float, float]],
    preference: RoutePreference,
) -> dict:
    """
    Build and calculate a complete trip route.
    """

    coordinates = build_route_coordinates(
        start_coordinates,
        destination_coordinates,
        stop_coordinates,
    )

    return calculate_multi_stop_route(
        coordinates,
        preference,
    )