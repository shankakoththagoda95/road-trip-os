import pytest

from app.services.trip_budget import (
    calculate_actual_total,
    calculate_estimated_total,
    calculate_remaining_budget,
)


def test_calculate_estimated_total():
    total = calculate_estimated_total(
        estimated_fuel_cost=100,
        estimated_ev_charging_cost=50,
        estimated_toll_cost=20,
        estimated_food_cost=200,
        estimated_parking_cost=30,
        estimated_other_cost=10,
    )

    assert total == 410


def test_calculate_actual_total():
    total = calculate_actual_total(
        actual_fuel_cost=80,
        actual_ev_charging_cost=40,
        actual_toll_cost=20,
        actual_food_cost=150,
        actual_parking_cost=20,
        actual_other_cost=5,
    )

    assert total == 315


def test_calculate_remaining_budget():
    remaining = calculate_remaining_budget(
        estimated_total=410,
        actual_total=315,
    )

    assert remaining == 95


def test_calculate_remaining_budget_can_be_negative():
    remaining = calculate_remaining_budget(
        estimated_total=300,
        actual_total=350,
    )

    assert remaining == -50


@pytest.mark.parametrize(
    "estimated_values, expected",
    [
        ((0, 0, 0, 0, 0, 0), 0),
        ((100, 0, 0, 0, 0, 0), 100),
        ((0, 50, 25, 0, 0, 0), 75),
        ((10, 20, 30, 40, 50, 60), 210),
    ],
)
def test_calculate_estimated_total_cases(estimated_values, expected):
    assert calculate_estimated_total(*estimated_values) == expected


@pytest.mark.parametrize(
    "actual_values, expected",
    [
        ((0, 0, 0, 0, 0, 0), 0),
        ((100, 0, 0, 0, 0, 0), 100),
        ((0, 50, 25, 0, 0, 0), 75),
        ((10, 20, 30, 40, 50, 60), 210),
    ],
)
def test_calculate_actual_total_cases(actual_values, expected):
    assert calculate_actual_total(*actual_values) == expected