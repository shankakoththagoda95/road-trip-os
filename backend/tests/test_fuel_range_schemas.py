import pytest
from pydantic import ValidationError

from app.schemas.fuel_range import VehicleFuelRangeResponse


def test_vehicle_fuel_range_response_accepts_valid_data():
    response = VehicleFuelRangeResponse(
        vehicle_id=1,
        fuel_available=60,
        fuel_consumption=6,
        estimated_range_km=1000,
    )

    assert response.vehicle_id == 1
    assert response.fuel_available == 60
    assert response.fuel_consumption == 6
    assert response.estimated_range_km == 1000


def test_vehicle_fuel_range_response_rejects_missing_vehicle_id():
    with pytest.raises(ValidationError):
        VehicleFuelRangeResponse(
            fuel_available=60,
            fuel_consumption=6,
            estimated_range_km=1000,
        )


def test_vehicle_fuel_range_response_rejects_missing_fuel_available():
    with pytest.raises(ValidationError):
        VehicleFuelRangeResponse(
            vehicle_id=1,
            fuel_consumption=6,
            estimated_range_km=1000,
        )


def test_vehicle_fuel_range_response_rejects_missing_fuel_consumption():
    with pytest.raises(ValidationError):
        VehicleFuelRangeResponse(
            vehicle_id=1,
            fuel_available=60,
            estimated_range_km=1000,
        )


def test_vehicle_fuel_range_response_rejects_missing_estimated_range():
    with pytest.raises(ValidationError):
        VehicleFuelRangeResponse(
            vehicle_id=1,
            fuel_available=60,
            fuel_consumption=6,
        )