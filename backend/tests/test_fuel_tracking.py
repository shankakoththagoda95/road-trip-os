import pytest

from app.services.fuel_tracking import estimate_fuel_remaining
from app.services.geography import calculate_distance_km


def test_estimate_fuel_remaining():
    coordinates = [
        (59.3293, 18.0686),
        (59.3326, 18.0649),
    ]

    distance_traveled, fuel_remaining, remaining_range = (
        estimate_fuel_remaining(
            coordinates=coordinates,
            starting_fuel=60,
            consumption_l_per_100km=6,
        )
    )

    assert distance_traveled > 0
    assert fuel_remaining < 60
    assert fuel_remaining > 0
    assert remaining_range > 0


def test_estimate_fuel_remaining_with_no_movement():
    coordinates = [
        (59.3293, 18.0686),
    ]

    distance_traveled, fuel_remaining, remaining_range = (
        estimate_fuel_remaining(
            coordinates=coordinates,
            starting_fuel=60,
            consumption_l_per_100km=6,
        )
    )

    assert distance_traveled == 0
    assert fuel_remaining == 60
    assert remaining_range == 1000


def test_estimate_fuel_remaining_does_not_go_below_zero():
    coordinates = [
        (59.3293, 18.0686),
        (0.0, 0.0),
    ]

    distance_traveled, fuel_remaining, remaining_range = (
        estimate_fuel_remaining(
            coordinates=coordinates,
            starting_fuel=10,
            consumption_l_per_100km=5,
        )
    )

    assert distance_traveled > 0
    assert fuel_remaining == 0
    assert remaining_range == 0


def test_estimate_fuel_remaining_with_no_locations():
    distance_traveled, fuel_remaining, remaining_range = (
        estimate_fuel_remaining(
            coordinates=[],
            starting_fuel=55,
            consumption_l_per_100km=6,
        )
    )

    assert distance_traveled == 0
    assert fuel_remaining == 55
    assert remaining_range == pytest.approx(916.6666667)


def test_estimate_fuel_remaining_ignores_gps_drift():
    coordinates = [
        (59.3293, 18.0686),
        (59.32931, 18.06861),
        (59.32932, 18.06862),
        (59.3310, 18.0700),
    ]

    distance_traveled, fuel_remaining, remaining_range = (
        estimate_fuel_remaining(
            coordinates=coordinates,
            starting_fuel=60,
            consumption_l_per_100km=6,
        )
    )

    expected_distance = calculate_distance_km(
        59.3293,
        18.0686,
        59.3310,
        18.0700,
    )

    expected_fuel_used = (expected_distance / 100) * 6

    assert distance_traveled == pytest.approx(expected_distance)
    assert fuel_remaining == pytest.approx(60 - expected_fuel_used)
    assert remaining_range == pytest.approx(
        ((60 - expected_fuel_used) / 6) * 100
    )