import pytest

from app.services.fuel import (
    calculate_fuel_cost,
    calculate_fuel_range,
    calculate_fuel_required,
)


def test_calculate_fuel_required():
    result = calculate_fuel_required(
        distance_km=600,
        consumption_l_per_100km=6,
    )

    assert result == 36


def test_calculate_fuel_required_with_decimal_consumption():
    result = calculate_fuel_required(
        distance_km=250,
        consumption_l_per_100km=7.5,
    )

    assert result == 18.75


def test_calculate_fuel_cost():
    result = calculate_fuel_cost(
        fuel_required=36,
        fuel_price_per_liter=1.80,
    )

    assert result == 64.8


def test_zero_distance_requires_zero_fuel():
    assert calculate_fuel_required(0, 6) == 0


def test_zero_fuel_price_has_zero_cost():
    assert calculate_fuel_cost(36, 0) == 0


@pytest.mark.parametrize(
    "distance",
    [-1, -100],
)
def test_negative_distance_is_rejected(distance):
    with pytest.raises(ValueError, match="Distance cannot be negative"):
        calculate_fuel_required(distance, 6)


@pytest.mark.parametrize(
    "consumption",
    [-1, -5],
)
def test_negative_consumption_is_rejected(consumption):
    with pytest.raises(ValueError, match="Fuel consumption cannot be negative"):
        calculate_fuel_required(600, consumption)


@pytest.mark.parametrize(
    "fuel_required",
    [-1, -10],
)
def test_negative_fuel_required_is_rejected(fuel_required):
    with pytest.raises(ValueError, match="Fuel required cannot be negative"):
        calculate_fuel_cost(fuel_required, 1.80)


@pytest.mark.parametrize(
    "fuel_price",
    [-1, -2],
)
def test_negative_fuel_price_is_rejected(fuel_price):
    with pytest.raises(ValueError, match="Fuel price cannot be negative"):
        calculate_fuel_cost(36, fuel_price)


def test_calculate_fuel_range():
    result = calculate_fuel_range(
        fuel_available=60,
        consumption_l_per_100km=6,
    )

    assert result == 1000


def test_calculate_fuel_range_with_different_values():
    result = calculate_fuel_range(
        fuel_available=40,
        consumption_l_per_100km=8,
    )

    assert result == 500


def test_calculate_fuel_range_with_zero_fuel():
    result = calculate_fuel_range(
        fuel_available=0,
        consumption_l_per_100km=6,
    )

    assert result == 0


def test_calculate_fuel_range_rejects_negative_fuel():
    with pytest.raises(ValueError, match="Fuel available cannot be negative"):
        calculate_fuel_range(
            fuel_available=-1,
            consumption_l_per_100km=6,
        )


def test_calculate_fuel_range_rejects_zero_consumption():
    with pytest.raises(
        ValueError,
        match="Fuel consumption must be greater than zero",
    ):
        calculate_fuel_range(
            fuel_available=60,
            consumption_l_per_100km=0,
        )


def test_calculate_fuel_range_rejects_negative_consumption():
    with pytest.raises(
        ValueError,
        match="Fuel consumption must be greater than zero",
    ):
        calculate_fuel_range(
            fuel_available=60,
            consumption_l_per_100km=-1,
        )