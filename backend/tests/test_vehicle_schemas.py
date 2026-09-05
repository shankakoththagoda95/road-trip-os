import pytest
from pydantic import ValidationError

from app.schemas.vehicle import (
    FuelType,
    VehicleCreate,
    VehicleType,
    VehicleUpdate,
)


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


@pytest.mark.parametrize(
    "vehicle_type",
    [
        VehicleType.CAR,
        VehicleType.MOTORCYCLE,
        VehicleType.CAMPERVAN,
        VehicleType.VAN,
    ],
)
def test_vehicle_create_accepts_supported_vehicle_types(vehicle_type):
    vehicle = VehicleCreate(
        name="My Vehicle",
        vehicle_type=vehicle_type,
        fuel_type=FuelType.PETROL,
    )

    assert vehicle.vehicle_type == vehicle_type


@pytest.mark.parametrize(
    "fuel_type",
    [
        FuelType.PETROL,
        FuelType.DIESEL,
        FuelType.HYBRID,
        FuelType.ELECTRIC,
    ],
)
def test_vehicle_create_accepts_supported_fuel_types(fuel_type):
    vehicle = VehicleCreate(
        name="My Vehicle",
        vehicle_type=VehicleType.CAR,
        fuel_type=fuel_type,
    )

    assert vehicle.fuel_type == fuel_type


def test_vehicle_create_rejects_unsupported_vehicle_type():
    with pytest.raises(ValidationError):
        VehicleCreate(
            name="My Vehicle",
            vehicle_type="spaceship",
            fuel_type=FuelType.PETROL,
        )


def test_vehicle_create_rejects_unsupported_fuel_type():
    with pytest.raises(ValidationError):
        VehicleCreate(
            name="My Vehicle",
            vehicle_type=VehicleType.CAR,
            fuel_type="banana",
        )


def test_vehicle_update_rejects_unsupported_vehicle_type():
    with pytest.raises(ValidationError):
        VehicleUpdate(
            name="My Vehicle",
            vehicle_type="spaceship",
            fuel_type=FuelType.PETROL,
        )


def test_vehicle_update_rejects_unsupported_fuel_type():
    with pytest.raises(ValidationError):
        VehicleUpdate(
            name="My Vehicle",
            vehicle_type=VehicleType.CAR,
            fuel_type="banana",
        )


def test_vehicle_create_accepts_valid_ev_measurements():
    vehicle = VehicleCreate(
        name="My EV",
        vehicle_type=VehicleType.CAR,
        fuel_type=FuelType.ELECTRIC,
        battery_capacity=75,
        energy_consumption=18,
    )

    assert vehicle.battery_capacity == 75
    assert vehicle.energy_consumption == 18


def test_vehicle_update_accepts_valid_ev_measurements():
    vehicle = VehicleUpdate(
        name="My EV",
        vehicle_type=VehicleType.CAR,
        fuel_type=FuelType.ELECTRIC,
        battery_capacity=82,
        energy_consumption=20,
    )

    assert vehicle.battery_capacity == 82
    assert vehicle.energy_consumption == 20


@pytest.mark.parametrize(
    "field",
    [
        "battery_capacity",
        "energy_consumption",
    ],
)
def test_vehicle_create_rejects_zero_ev_measurements(field):
    with pytest.raises(ValidationError):
        VehicleCreate(
            name="My EV",
            vehicle_type=VehicleType.CAR,
            fuel_type=FuelType.ELECTRIC,
            **{field: 0},
        )


@pytest.mark.parametrize(
    "field",
    [
        "battery_capacity",
        "energy_consumption",
    ],
)
def test_vehicle_create_rejects_negative_ev_measurements(field):
    with pytest.raises(ValidationError):
        VehicleCreate(
            name="My EV",
            vehicle_type=VehicleType.CAR,
            fuel_type=FuelType.ELECTRIC,
            **{field: -10},
        )


def test_vehicle_create_allows_missing_ev_measurements():
    vehicle = VehicleCreate(
        name="My Petrol Car",
        vehicle_type=VehicleType.CAR,
        fuel_type=FuelType.PETROL,
    )

    assert vehicle.battery_capacity is None
    assert vehicle.energy_consumption is None