import pytest
from pydantic import ValidationError

from app.schemas.trip_fuel import (
    TripFuelCreate,
    TripFuelUpdate,
)


VALID_FUEL_DATA = {
    "starting_fuel": 50,
    "current_fuel": 40,
    "fuel_used": 10,
    "fuel_cost": 25,
}


def test_valid_trip_fuel_create():
    fuel = TripFuelCreate(**VALID_FUEL_DATA)

    assert fuel.starting_fuel == 50
    assert fuel.current_fuel == 40
    assert fuel.fuel_used == 10
    assert fuel.fuel_cost == 25


def test_zero_fuel_values_are_allowed():
    fuel = TripFuelCreate(
        starting_fuel=0,
        current_fuel=0,
        fuel_used=0,
        fuel_cost=0,
    )

    assert fuel.starting_fuel == 0
    assert fuel.current_fuel == 0
    assert fuel.fuel_used == 0
    assert fuel.fuel_cost == 0


@pytest.mark.parametrize(
    "field",
    [
        "starting_fuel",
        "current_fuel",
        "fuel_used",
        "fuel_cost",
    ],
)
def test_negative_fuel_values_are_rejected(field):
    data = VALID_FUEL_DATA.copy()
    data[field] = -1

    with pytest.raises(ValidationError):
        TripFuelCreate(**data)


def test_valid_trip_fuel_update():
    fuel = TripFuelUpdate(
        starting_fuel=60,
        current_fuel=45,
        fuel_used=15,
        fuel_cost=30,
    )

    assert fuel.starting_fuel == 60
    assert fuel.current_fuel == 45
    assert fuel.fuel_used == 15
    assert fuel.fuel_cost == 30


@pytest.mark.parametrize(
    "field",
    [
        "starting_fuel",
        "current_fuel",
        "fuel_used",
        "fuel_cost",
    ],
)
def test_negative_update_fuel_values_are_rejected(field):
    data = VALID_FUEL_DATA.copy()
    data[field] = -1

    with pytest.raises(ValidationError):
        TripFuelUpdate(**data)