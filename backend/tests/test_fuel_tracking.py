import pytest

from app.services.geography import calculate_distance_km
from app.services.fuel_tracking import (
    calculate_fuel_for_movement,
    estimate_fuel_remaining,
    update_fuel_for_movement,
)


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


def test_estimate_fuel_remaining_uses_20_meter_default_threshold():
    coordinates = [
        (59.3293, 18.0686),
        (59.32931, 18.06861),
    ]

    distance_traveled, _, _ = estimate_fuel_remaining(
        coordinates=coordinates,
        starting_fuel=60,
        consumption_l_per_100km=6,
    )

    assert distance_traveled == 0.0


def test_estimate_fuel_remaining_accepts_custom_threshold():
    coordinates = [
        (59.3293, 18.0686),
        (59.3295, 18.0688),
    ]

    distance_traveled, _, _ = estimate_fuel_remaining(
        coordinates=coordinates,
        starting_fuel=60,
        consumption_l_per_100km=6,
        threshold_meters=1,
    )

    assert distance_traveled > 0


def test_estimate_fuel_remaining_rejects_invalid_threshold():
    with pytest.raises(
        ValueError,
        match="between 1 and 1000 meters",
    ):
        estimate_fuel_remaining(
            coordinates=[],
            starting_fuel=60,
            consumption_l_per_100km=6,
            threshold_meters=1001,
        )


def test_calculate_fuel_for_movement():
    distance_km, fuel_used = calculate_fuel_for_movement(
        start=(59.3293, 18.0686),
        end=(59.3326, 18.0649),
        consumption_l_per_100km=6,
    )

    assert distance_km > 0
    assert fuel_used > 0


def test_update_fuel_for_movement():
    current_fuel, total_fuel_used = update_fuel_for_movement(
        current_fuel=60,
        total_fuel_used=0,
        fuel_used_for_movement=3,
    )

    assert current_fuel == 57
    assert total_fuel_used == 3


def test_update_fuel_for_movement_does_not_go_below_zero():
    current_fuel, total_fuel_used = update_fuel_for_movement(
        current_fuel=5,
        total_fuel_used=10,
        fuel_used_for_movement=8,
    )

    assert current_fuel == 0
    assert total_fuel_used == 18


def test_update_fuel_for_movement_rejects_negative_values():
    import pytest

    with pytest.raises(ValueError):
        update_fuel_for_movement(
            current_fuel=-1,
            total_fuel_used=0,
            fuel_used_for_movement=1,
        )

    with pytest.raises(ValueError):
        update_fuel_for_movement(
            current_fuel=10,
            total_fuel_used=-1,
            fuel_used_for_movement=1,
        )

    with pytest.raises(ValueError):
        update_fuel_for_movement(
            current_fuel=10,
            total_fuel_used=0,
            fuel_used_for_movement=-1,
        )