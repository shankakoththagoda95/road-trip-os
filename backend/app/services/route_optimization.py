from app.models.trip_destination import TripDestination


def optimize_destinations(
    destinations: list[TripDestination],
) -> list[TripDestination]:
    """
    Return destinations in optimized order.

    Optimization logic will be added next.
    """

    return sorted(
        destinations,
        key=lambda destination: destination.stop_order,
    )