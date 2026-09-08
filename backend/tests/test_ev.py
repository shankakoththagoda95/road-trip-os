import pytest

from app.services.ev import (
    calculate_available_battery_energy,
    calculate_ev_range,
    calculate_charging_requirement,
    calculate_vehicle_charging_requirement,
    calculate_usable_ev_range,
    calculate_vehicle_charging_requirement_with_buffer,
    needs_charging_stop,
)


def test_calculate_ev_range():
    result = calculate_ev_range(
        battery_capacity_kwh=60.0,
        battery_percentage=80.0,
        energy_consumption_kwh_per_100km=18.0,
    )

    assert result == pytest.approx(266.67, rel=1e-3)


def test_calculate_ev_range_with_full_battery():
    result = calculate_ev_range(
        battery_capacity_kwh=60.0,
        battery_percentage=100.0,
        energy_consumption_kwh_per_100km=20.0,
    )

    assert result == pytest.approx(300.0)


def test_calculate_ev_range_with_empty_battery():
    result = calculate_ev_range(
        battery_capacity_kwh=60.0,
        battery_percentage=0.0,
        energy_consumption_kwh_per_100km=20.0,
    )

    assert result == pytest.approx(0.0)


@pytest.mark.parametrize(
    "battery_capacity_kwh,battery_percentage,consumption",
    [
        (0.0, 50.0, 20.0),
        (-1.0, 50.0, 20.0),
    ],
)
def test_calculate_ev_range_rejects_invalid_battery_capacity(
    battery_capacity_kwh,
    battery_percentage,
    consumption,
):
    with pytest.raises(ValueError):
        calculate_ev_range(
            battery_capacity_kwh=battery_capacity_kwh,
            battery_percentage=battery_percentage,
            energy_consumption_kwh_per_100km=consumption,
        )


@pytest.mark.parametrize(
    "battery_percentage",
    [-1.0, 101.0],
)
def test_calculate_ev_range_rejects_invalid_battery_percentage(
    battery_percentage,
):
    with pytest.raises(ValueError):
        calculate_ev_range(
            battery_capacity_kwh=60.0,
            battery_percentage=battery_percentage,
            energy_consumption_kwh_per_100km=20.0,
        )


def test_calculate_ev_range_rejects_invalid_energy_consumption():
    with pytest.raises(ValueError):
        calculate_ev_range(
            battery_capacity_kwh=60.0,
            battery_percentage=80.0,
            energy_consumption_kwh_per_100km=0.0,
        )


def test_calculate_available_battery_energy():
    result = calculate_available_battery_energy(
        battery_capacity_kwh=77.0,
        battery_percentage=80.0,
    )

    assert result == pytest.approx(61.6)


def test_calculate_available_battery_energy_with_full_battery():
    result = calculate_available_battery_energy(
        battery_capacity_kwh=77.0,
        battery_percentage=100.0,
    )

    assert result == pytest.approx(77.0)


def test_calculate_available_battery_energy_with_empty_battery():
    result = calculate_available_battery_energy(
        battery_capacity_kwh=77.0,
        battery_percentage=0.0,
    )

    assert result == pytest.approx(0.0)


def test_calculate_available_battery_energy_rejects_invalid_capacity():
    with pytest.raises(ValueError):
        calculate_available_battery_energy(
            battery_capacity_kwh=0.0,
            battery_percentage=50.0,
        )


@pytest.mark.parametrize(
    "battery_percentage",
    [-1.0, 101.0],
)
def test_calculate_available_battery_energy_rejects_invalid_percentage(
    battery_percentage,
):
    with pytest.raises(ValueError):
        calculate_available_battery_energy(
            battery_capacity_kwh=77.0,
            battery_percentage=battery_percentage,
        )


def test_needs_charging_stop_when_route_exceeds_range():
    assert needs_charging_stop(
        available_range_km=250,
        route_distance_km=320,
    ) is True


def test_does_not_need_charging_stop_when_route_is_within_range():
    assert needs_charging_stop(
        available_range_km=250,
        route_distance_km=180,
    ) is False


def test_does_not_need_charging_stop_when_route_equals_range():
    assert needs_charging_stop(
        available_range_km=250,
        route_distance_km=250,
    ) is False


def test_needs_charging_stop_rejects_negative_range():
    with pytest.raises(ValueError, match="Available range cannot be negative"):
        needs_charging_stop(
            available_range_km=-1,
            route_distance_km=100,
        )


def test_needs_charging_stop_rejects_negative_route_distance():
    with pytest.raises(ValueError, match="Route distance cannot be negative"):
        needs_charging_stop(
            available_range_km=250,
            route_distance_km=-1,
        )


def test_calculate_charging_requirement_when_charging_is_needed():
    result = calculate_charging_requirement(
        available_range_km=250,
        route_distance_km=320,
    )

    assert result.needs_charging is True
    assert result.available_range_km == 250
    assert result.route_distance_km == 320
    assert result.range_shortfall_km == 70


def test_calculate_charging_requirement_when_charging_is_not_needed():
    result = calculate_charging_requirement(
        available_range_km=250,
        route_distance_km=180,
    )

    assert result.needs_charging is False
    assert result.available_range_km == 250
    assert result.route_distance_km == 180
    assert result.range_shortfall_km == 0


def test_calculate_charging_requirement_when_route_equals_range():
    result = calculate_charging_requirement(
        available_range_km=250,
        route_distance_km=250,
    )

    assert result.needs_charging is False
    assert result.range_shortfall_km == 0


def test_calculate_charging_requirement_rejects_negative_range():
    with pytest.raises(ValueError, match="Available range cannot be negative"):
        calculate_charging_requirement(
            available_range_km=-1,
            route_distance_km=100,
        )


def test_calculate_charging_requirement_rejects_negative_route_distance():
    with pytest.raises(ValueError, match="Route distance cannot be negative"):
        calculate_charging_requirement(
            available_range_km=250,
            route_distance_km=-1,
        )


def test_calculate_vehicle_charging_requirement_when_charging_is_needed():
    result = calculate_vehicle_charging_requirement(
        battery_capacity_kwh=75,
        battery_percentage=80,
        energy_consumption_kwh_per_100km=20,
        route_distance_km=350,
    )

    assert result.needs_charging is True
    assert result.available_range_km == 300
    assert result.route_distance_km == 350
    assert result.range_shortfall_km == 50


def test_calculate_vehicle_charging_requirement_when_charging_is_not_needed():
    result = calculate_vehicle_charging_requirement(
        battery_capacity_kwh=75,
        battery_percentage=80,
        energy_consumption_kwh_per_100km=20,
        route_distance_km=250,
    )

    assert result.needs_charging is False
    assert result.available_range_km == 300
    assert result.route_distance_km == 250
    assert result.range_shortfall_km == 0


def test_calculate_vehicle_charging_requirement_rejects_invalid_battery():
    with pytest.raises(
        ValueError,
        match="Battery capacity must be greater than zero",
    ):
        calculate_vehicle_charging_requirement(
            battery_capacity_kwh=0,
            battery_percentage=80,
            energy_consumption_kwh_per_100km=20,
            route_distance_km=250,
        )


def test_calculate_vehicle_charging_requirement_rejects_invalid_consumption():
    with pytest.raises(
        ValueError,
        match="Energy consumption must be greater than zero",
    ):
        calculate_vehicle_charging_requirement(
            battery_capacity_kwh=75,
            battery_percentage=80,
            energy_consumption_kwh_per_100km=0,
            route_distance_km=250,
        )


def test_calculate_vehicle_charging_requirement_rejects_invalid_battery_percentage():
    with pytest.raises(
        ValueError,
        match="Battery percentage must be between 0 and 100",
    ):
        calculate_vehicle_charging_requirement(
            battery_capacity_kwh=75,
            battery_percentage=101,
            energy_consumption_kwh_per_100km=20,
            route_distance_km=250,
        )


def test_calculate_usable_ev_range_with_default_buffer():
    result = calculate_usable_ev_range(
        available_range_km=300,
    )

    assert result == 240


def test_calculate_usable_ev_range_with_custom_buffer():
    result = calculate_usable_ev_range(
        available_range_km=300,
        safety_buffer_percentage=10,
    )

    assert result == 270


def test_calculate_usable_ev_range_with_zero_buffer():
    result = calculate_usable_ev_range(
        available_range_km=300,
        safety_buffer_percentage=0,
    )

    assert result == 300


def test_calculate_usable_ev_range_rejects_negative_range():
    with pytest.raises(
        ValueError,
        match="Available range cannot be negative",
    ):
        calculate_usable_ev_range(
            available_range_km=-1,
        )


def test_calculate_usable_ev_range_rejects_invalid_buffer():
    with pytest.raises(
        ValueError,
        match="Safety buffer percentage must be between 0 and 100",
    ):
        calculate_usable_ev_range(
            available_range_km=300,
            safety_buffer_percentage=100,
        )


def test_calculate_usable_ev_range_rejects_negative_buffer():
    with pytest.raises(
        ValueError,
        match="Safety buffer percentage must be between 0 and 100",
    ):
        calculate_usable_ev_range(
            available_range_km=300,
            safety_buffer_percentage=-1,
        )


def test_vehicle_charging_requirement_with_buffer_needs_charging():
    result = calculate_vehicle_charging_requirement_with_buffer(
        battery_capacity_kwh=75,
        battery_percentage=80,
        energy_consumption_kwh_per_100km=20,
        route_distance_km=250,
        safety_buffer_percentage=20,
    )

    assert result.needs_charging is True
    assert result.available_range_km == 240
    assert result.route_distance_km == 250
    assert result.range_shortfall_km == 10


def test_vehicle_charging_requirement_with_buffer_does_not_need_charging():
    result = calculate_vehicle_charging_requirement_with_buffer(
        battery_capacity_kwh=75,
        battery_percentage=80,
        energy_consumption_kwh_per_100km=20,
        route_distance_km=200,
        safety_buffer_percentage=20,
    )

    assert result.needs_charging is False
    assert result.available_range_km == 240
    assert result.route_distance_km == 200
    assert result.range_shortfall_km == 0


def test_vehicle_charging_requirement_with_custom_buffer():
    result = calculate_vehicle_charging_requirement_with_buffer(
        battery_capacity_kwh=75,
        battery_percentage=80,
        energy_consumption_kwh_per_100km=20,
        route_distance_km=270,
        safety_buffer_percentage=10,
    )

    assert result.needs_charging is False
    assert result.available_range_km == 270
    assert result.range_shortfall_km == 0


def test_vehicle_charging_requirement_with_buffer_rejects_invalid_buffer():
    with pytest.raises(
        ValueError,
        match="Safety buffer percentage must be between 0 and 100",
    ):
        calculate_vehicle_charging_requirement_with_buffer(
            battery_capacity_kwh=75,
            battery_percentage=80,
            energy_consumption_kwh_per_100km=20,
            route_distance_km=200,
            safety_buffer_percentage=100,
        )