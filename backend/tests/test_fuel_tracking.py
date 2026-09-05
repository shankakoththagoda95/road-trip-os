import pytest

from app.services.fuel_tracking import estimate_fuel_remaining


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