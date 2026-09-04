import pytest

from app.models.trip_destination import TripDestination
from app.services.route_optimization import (
    calculate_destination_distance,
    calculate_start_distance,
    optimize_destinations,
)


def create_destination(
    location: str,
    stop_order: int,
    latitude: float | None = None,
    longitude: float | None = None,
) -> TripDestination:
    return TripDestination(
        location=location,
        stop_order=stop_order,
        latitude=latitude,
        longitude=longitude,
    )


def test_optimize_destinations_orders_from_trip_start():
    stockholm = create_destination(
        "Stockholm",
        1,
        59.3293,
        18.0686,
    )

    oslo = create_destination(
        "Oslo",
        2,
        59.9139,
        10.7522,
    )

    orebro = create_destination(
        "Örebro",
        3,
        59.2753,
        15.2134,
    )

    result = optimize_destinations(
        (59.3293, 18.0686),
        [oslo, orebro],
    )

    assert [destination.location for destination in result] == [
        "Örebro",
        "Oslo",
    ]


def test_optimize_destinations_returns_empty_list_for_no_destinations():
    result = optimize_destinations(
        (59.3293, 18.0686),
        [],
    )

    assert result == []


def test_optimize_destinations_does_not_modify_original_list():
    stockholm = create_destination(
        "Stockholm",
        1,
        59.3293,
        18.0686,
    )

    oslo = create_destination(
        "Oslo",
        2,
        59.9139,
        10.7522,
    )

    destinations = [stockholm, oslo]
    original_order = destinations.copy()

    result = optimize_destinations(
        (59.3293, 18.0686),
        destinations,
    )

    assert destinations == original_order
    assert result is not destinations


def test_optimize_destinations_handles_single_destination():
    oslo = create_destination(
        "Oslo",
        1,
        59.9139,
        10.7522,
    )

    result = optimize_destinations(
        (59.3293, 18.0686),
        [oslo],
    )

    assert len(result) == 1
    assert result[0].location == "Oslo"


def test_optimize_destinations_handles_already_optimized_destinations():
    orebro = create_destination(
        "Örebro",
        1,
        59.2753,
        15.2134,
    )

    oslo = create_destination(
        "Oslo",
        2,
        59.9139,
        10.7522,
    )

    result = optimize_destinations(
        (59.3293, 18.0686),
        [orebro, oslo],
    )

    assert [destination.location for destination in result] == [
        "Örebro",
        "Oslo",
    ]


def test_optimize_destinations_requires_coordinates():
    oslo = create_destination(
        "Oslo",
        1,
    )

    with pytest.raises(
        ValueError,
        match="All destinations must have valid coordinates",
    ):
        optimize_destinations(
            (59.3293, 18.0686),
            [oslo],
        )


def test_calculate_destination_distance():
    stockholm = create_destination(
        "Stockholm",
        1,
        59.3293,
        18.0686,
    )

    oslo = create_destination(
        "Oslo",
        2,
        59.9139,
        10.7522,
    )

    distance = calculate_destination_distance(
        stockholm,
        oslo,
    )

    assert distance == pytest.approx(416, abs=5)


def test_calculate_destination_distance_is_symmetric():
    stockholm = create_destination(
        "Stockholm",
        1,
        59.3293,
        18.0686,
    )

    oslo = create_destination(
        "Oslo",
        2,
        59.9139,
        10.7522,
    )

    stockholm_to_oslo = calculate_destination_distance(
        stockholm,
        oslo,
    )

    oslo_to_stockholm = calculate_destination_distance(
        oslo,
        stockholm,
    )

    assert stockholm_to_oslo == pytest.approx(
        oslo_to_stockholm
    )


def test_calculate_destination_distance_requires_coordinates():
    stockholm = create_destination(
        "Stockholm",
        1,
    )

    oslo = create_destination(
        "Oslo",
        2,
        59.9139,
        10.7522,
    )

    with pytest.raises(
        ValueError,
        match="Both destinations must have valid coordinates",
    ):
        calculate_destination_distance(
            stockholm,
            oslo,
        )


def test_calculate_start_distance():
    oslo = create_destination(
        "Oslo",
        1,
        59.9139,
        10.7522,
    )

    distance = calculate_start_distance(
        (59.3293, 18.0686),
        oslo,
    )

    assert distance == pytest.approx(416, abs=5)


def test_calculate_start_distance_requires_coordinates():
    oslo = create_destination(
        "Oslo",
        1,
    )

    with pytest.raises(
        ValueError,
        match="Destination must have valid coordinates",
    ):
        calculate_start_distance(
            (59.3293, 18.0686),
            oslo,
        )