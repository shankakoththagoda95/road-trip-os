import pytest
from pydantic import ValidationError

from app.schemas.trip_ev import (
    TripEVCreate,
    TripEVUpdate,
)


def test_valid_trip_ev_create():
    trip_ev = TripEVCreate(
        starting_battery_percentage=80,
    )

    assert trip_ev.starting_battery_percentage == 80


def test_zero_battery_percentage_is_allowed():
    trip_ev = TripEVCreate(
        starting_battery_percentage=0,
    )

    assert trip_ev.starting_battery_percentage == 0


def test_full_battery_percentage_is_allowed():
    trip_ev = TripEVCreate(
        starting_battery_percentage=100,
    )

    assert trip_ev.starting_battery_percentage == 100


@pytest.mark.parametrize(
    "battery_percentage",
    [-1, 101],
)
def test_invalid_battery_percentage_is_rejected(
    battery_percentage,
):
    with pytest.raises(ValidationError):
        TripEVCreate(
            starting_battery_percentage=battery_percentage,
        )


def test_valid_trip_ev_update():
    trip_ev = TripEVUpdate(
        starting_battery_percentage=65,
    )

    assert trip_ev.starting_battery_percentage == 65


@pytest.mark.parametrize(
    "battery_percentage",
    [-1, 101],
)
def test_invalid_update_battery_percentage_is_rejected(
    battery_percentage,
):
    with pytest.raises(ValidationError):
        TripEVUpdate(
            starting_battery_percentage=battery_percentage,
        )