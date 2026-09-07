import pytest

from app.services.ev import calculate_ev_range, calculate_available_battery_energy

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