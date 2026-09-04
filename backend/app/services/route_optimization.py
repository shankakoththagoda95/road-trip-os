from app.models.trip_destination import TripDestination
from app.services.geography import calculate_distance_km


Coordinates = tuple[float, float]


def calculate_destination_distance(
    origin: TripDestination,
    destination: TripDestination,
) -> float:
    """
    Calculate the geographic distance between two destinations.
    """

    if (
        origin.latitude is None
        or origin.longitude is None
        or destination.latitude is None
        or destination.longitude is None
    ):
        raise ValueError(
            "Both destinations must have valid coordinates"
        )

    return calculate_distance_km(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude,
    )


def calculate_start_distance(
    start_coordinates: Coordinates,
    destination: TripDestination,
) -> float:
    """
    Calculate the geographic distance from the trip start
    to a destination.
    """

    if (
        destination.latitude is None
        or destination.longitude is None
    ):
        raise ValueError(
            "Destination must have valid coordinates"
        )

    return calculate_distance_km(
        start_coordinates[0],
        start_coordinates[1],
        destination.latitude,
        destination.longitude,
    )


def optimize_destinations(
    start_coordinates: Coordinates,
    destinations: list[TripDestination],
) -> list[TripDestination]:
    """
    Return destinations in geographically optimized order
    using a nearest-neighbor heuristic starting from the
    trip's starting coordinates.
    """

    if not destinations:
        return []

    for destination in destinations:
        if (
            destination.latitude is None
            or destination.longitude is None
        ):
            raise ValueError(
                "All destinations must have valid coordinates"
            )

    remaining = destinations.copy()
    optimized: list[TripDestination] = []

    current_coordinates = start_coordinates

    while remaining:
        next_destination = min(
            remaining,
            key=lambda destination: calculate_distance_km(
                current_coordinates[0],
                current_coordinates[1],
                destination.latitude,
                destination.longitude,
            ),
        )

        optimized.append(next_destination)
        remaining.remove(next_destination)

        current_coordinates = (
            next_destination.latitude,
            next_destination.longitude,
        )

    return optimized