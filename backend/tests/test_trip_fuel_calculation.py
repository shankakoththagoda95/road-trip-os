import pytest
from app.services.fuel import (
    calculate_fuel_cost,
    calculate_fuel_required,
    calculate_trip_fuel_cost,
)


def test_calculate_trip_fuel_required():
    fuel_required = calculate_fuel_required(
        distance_km=600,
        consumption_l_per_100km=6,
    )

    assert fuel_required == 36


def test_calculate_trip_fuel_cost():
    fuel_cost = calculate_fuel_cost(
        fuel_required=36,
        fuel_price_per_liter=1.80,
    )

    assert fuel_cost == 64.8


def test_calculate_trip_fuel_cost_combines_required_fuel_and_cost():
    fuel_required, fuel_cost = calculate_trip_fuel_cost(
        distance_km=600,
        consumption_l_per_100km=6,
        fuel_price_per_liter=1.80,
    )

    assert fuel_required == 36
    assert fuel_cost == 64.8


@pytest.mark.parametrize(
    "distance_km, consumption_l_per_100km, fuel_price_per_liter",
    [
        (-100, 6, 1.80),
        (600, -6, 1.80),
        (600, 6, -1.80),
    ],
)
def test_calculate_trip_fuel_cost_rejects_negative_values(
    distance_km,
    consumption_l_per_100km,
    fuel_price_per_liter,
):
    with pytest.raises(ValueError):
        calculate_trip_fuel_cost(
            distance_km=distance_km,
            consumption_l_per_100km=consumption_l_per_100km,
            fuel_price_per_liter=fuel_price_per_liter,
        )