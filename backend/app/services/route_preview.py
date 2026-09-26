from app.schemas.route import (
    RoutePointInput,
    RoutePointKind,
    RoutePreviewRequest,
)
from app.schemas.trip import TripType
from app.services.route_builder import (
    calculate_trip_route,
    resolve_location,
)


def resolve_point(point: RoutePointInput) -> tuple[float, float]:
    """
    Use the point's coordinates, or look them up from its name.
    """

    if point.latitude is not None and point.longitude is not None:
        return (point.latitude, point.longitude)

    return resolve_location(point.location)


def stay_nights(request: RoutePreviewRequest) -> list[int]:
    """
    Nights at the end of each leg: every stop, the destination, and none
    after the drive home on a round trip.
    """

    nights = [stop.nights for stop in request.stops] + [
        request.destination.nights
    ]

    if request.trip_type == TripType.ROUND_TRIP:
        nights.append(0)

    return nights


def preview_route(request: RoutePreviewRequest) -> dict:
    """
    Calculate a route for locations that are not saved as a trip yet.

    Order: start → stops → destination (→ start for round trips).
    """

    start = resolve_point(request.start)
    stops = [resolve_point(stop) for stop in request.stops]
    destination = resolve_point(request.destination)

    route = calculate_trip_route(
        start,
        destination,
        stops,
        request.preference,
        request.trip_type,
    )

    points = [
        (request.start, start, RoutePointKind.START),
        *[
            (stop, coordinates, RoutePointKind.STOP)
            for stop, coordinates in zip(request.stops, stops)
        ],
        (request.destination, destination, RoutePointKind.DESTINATION),
    ]

    names = [point.location for point, _, _ in points]

    if request.trip_type == TripType.ROUND_TRIP:
        names.append(request.start.location)

    return {
        "distance_meters": route["distance_meters"],
        "duration_seconds": route["duration_seconds"],
        "points": [
            {
                "location": point.location,
                "latitude": latitude,
                "longitude": longitude,
                "kind": kind,
            }
            for point, (latitude, longitude), kind in points
        ],
        "legs": [
            {
                "from_location": names[index],
                "to_location": names[index + 1],
                "distance_meters": leg["distance_meters"],
                "duration_seconds": leg["duration_seconds"],
            }
            for index, leg in enumerate(route["legs"])
        ],
        "geometry": route["geometry"],
    }
