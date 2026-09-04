from app.models.trip_destination import TripDestination
from app.services.route_optimization import optimize_destinations


def create_destination(
    location: str,
    stop_order: int,
) -> TripDestination:
    return TripDestination(
        location=location,
        stop_order=stop_order,
    )


def test_optimize_destinations_preserves_order():
    destinations = [
        create_destination("Oslo", 2),
        create_destination("Örebro", 1),
        create_destination("Karlstad", 3),
    ]

    result = optimize_destinations(destinations)

    assert [destination.location for destination in result] == [
        "Örebro",
        "Oslo",
        "Karlstad",
    ]


def test_optimize_destinations_returns_empty_list_for_no_destinations():
    result = optimize_destinations([])

    assert result == []


def test_optimize_destinations_does_not_modify_original_list():
    destinations = [
        create_destination("Oslo", 2),
        create_destination("Örebro", 1),
    ]

    original_order = destinations.copy()

    result = optimize_destinations(destinations)

    assert destinations == original_order
    assert result is not destinations


def test_optimize_destinations_handles_single_destination():
    destinations = [
        create_destination("Oslo", 1),
    ]

    result = optimize_destinations(destinations)

    assert len(result) == 1
    assert result[0].location == "Oslo"


def test_optimize_destinations_handles_already_sorted_destinations():
    destinations = [
        create_destination("Örebro", 1),
        create_destination("Karlstad", 2),
        create_destination("Oslo", 3),
    ]

    result = optimize_destinations(destinations)

    assert [destination.location for destination in result] == [
        "Örebro",
        "Karlstad",
        "Oslo",
    ]