import pytest
from pydantic import ValidationError

from app.schemas.vehicle import VehicleCreate, VehicleUpdate


def test_vehicle_create_accepts_valid_measurements():
    vehicle = VehicleCreate(
        name="My Car",
        vehicle_type="car",
        fuel_type="petrol",
        fuel_consumption=6.5,
        tank_capacity=55,
    )

    assert vehicle.fuel_consumption == 6.5
    assert vehicle.tank_capacity == 55


@pytest.mark.parametrize(
    "field",
    [
        "fuel_consumption",
        "tank_capacity",
    ],
)
def test_vehicle_create_rejects_zero_measurements(field):
    with pytest.raises(ValidationError):
        VehicleCreate(
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            **{field: 0},
        )


@pytest.mark.parametrize(
    "field",
    [
        "fuel_consumption",
        "tank_capacity",
    ],
)
def test_vehicle_create_rejects_negative_measurements(field):
    with pytest.raises(ValidationError):
        VehicleCreate(
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            **{field: -10},
        )


def test_vehicle_create_allows_missing_measurements():
    vehicle = VehicleCreate(
        name="My Car",
        vehicle_type="car",
        fuel_type="petrol",
    )

    assert vehicle.fuel_consumption is None
    assert vehicle.tank_capacity is None


def test_vehicle_update_rejects_invalid_measurements():
    with pytest.raises(ValidationError):
        VehicleUpdate(
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=0,
        )

    with pytest.raises(ValidationError):
        VehicleUpdate(
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            tank_capacity=-5,
        )