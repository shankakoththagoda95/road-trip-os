from pydantic import ValidationError
import pytest

from app.schemas.trip_budget import (
    TripBudgetCreate,
    TripBudgetResponse,
)


def test_trip_budget_create_defaults():
    budget = TripBudgetCreate()

    assert budget.currency == "EUR"
    assert budget.estimated_fuel_cost == 0
    assert budget.estimated_ev_charging_cost == 0
    assert budget.estimated_toll_cost == 0
    assert budget.estimated_food_cost == 0
    assert budget.estimated_parking_cost == 0
    assert budget.estimated_other_cost == 0
    assert budget.actual_fuel_cost == 0
    assert budget.actual_ev_charging_cost == 0
    assert budget.actual_toll_cost == 0
    assert budget.actual_food_cost == 0
    assert budget.actual_parking_cost == 0
    assert budget.actual_other_cost == 0


def test_trip_budget_create_accepts_valid_values():
    budget = TripBudgetCreate(
        currency="SEK",
        estimated_fuel_cost=500,
        estimated_food_cost=800,
        actual_fuel_cost=250,
        actual_food_cost=400,
    )

    assert budget.currency == "SEK"
    assert budget.estimated_fuel_cost == 500
    assert budget.estimated_food_cost == 800
    assert budget.actual_fuel_cost == 250
    assert budget.actual_food_cost == 400


@pytest.mark.parametrize(
    "field_name",
    [
        "estimated_fuel_cost",
        "estimated_ev_charging_cost",
        "estimated_toll_cost",
        "estimated_food_cost",
        "estimated_parking_cost",
        "estimated_other_cost",
        "actual_fuel_cost",
        "actual_ev_charging_cost",
        "actual_toll_cost",
        "actual_food_cost",
        "actual_parking_cost",
        "actual_other_cost",
    ],
)
def test_trip_budget_rejects_negative_cost(field_name):
    with pytest.raises(ValidationError):
        TripBudgetCreate(**{field_name: -1})


@pytest.mark.parametrize(
    "currency",
    [
        "",
        "E",
        "EURO",
    ],
)
def test_trip_budget_rejects_invalid_currency(currency):
    with pytest.raises(ValidationError):
        TripBudgetCreate(currency=currency)


def test_trip_budget_response_includes_totals():
    budget = TripBudgetResponse(
        id=1,
        trip_id=10,
        currency="EUR",
        estimated_fuel_cost=100,
        estimated_ev_charging_cost=50,
        estimated_toll_cost=20,
        estimated_food_cost=200,
        estimated_parking_cost=30,
        estimated_other_cost=10,
        actual_fuel_cost=80,
        actual_ev_charging_cost=40,
        actual_toll_cost=20,
        actual_food_cost=150,
        actual_parking_cost=20,
        actual_other_cost=5,
        estimated_total=410,
        actual_total=315,
        remaining_budget=95,
    )

    assert budget.estimated_total == 410
    assert budget.actual_total == 315
    assert budget.remaining_budget == 95