from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas.trip import TripCreate, TripType, TripUpdate


def valid_trip_data():
    return {
        "name": "Stockholm to Oslo",
        "start_location": "Stockholm",
        "destination": "Oslo",
        "trip_type": TripType.ONE_WAY,
        "departure_at": datetime.now() + timedelta(days=1),
        "travelers": 2,
        "duration_days": 2,
    }


def test_trip_create_accepts_vehicle_id():
    trip = TripCreate(
        **valid_trip_data(),
        vehicle_id=1,
    )

    assert trip.vehicle_id == 1


def test_trip_create_allows_missing_vehicle_id():
    trip = TripCreate(**valid_trip_data())

    assert trip.vehicle_id is None


@pytest.mark.parametrize("vehicle_id", [0, -1])
def test_trip_create_rejects_invalid_vehicle_id(vehicle_id):
    with pytest.raises(ValidationError):
        TripCreate(
            **valid_trip_data(),
            vehicle_id=vehicle_id,
        )


def test_trip_update_accepts_vehicle_id():
    trip = TripUpdate(
        **valid_trip_data(),
        vehicle_id=1,
    )

    assert trip.vehicle_id == 1


def test_trip_update_allows_missing_vehicle_id():
    trip = TripUpdate(**valid_trip_data())

    assert trip.vehicle_id is None


@pytest.mark.parametrize("vehicle_id", [0, -1])
def test_trip_update_rejects_invalid_vehicle_id(vehicle_id):
    with pytest.raises(ValidationError):
        TripUpdate(
            **valid_trip_data(),
            vehicle_id=vehicle_id,
        )

@pytest.mark.parametrize("schema", [TripCreate, TripUpdate])
def test_trip_accepts_timezone_aware_departure_as_local_time(schema):
    departure_at = (datetime.now() + timedelta(days=1)).replace(
        hour=9,
        minute=0,
        second=0,
        microsecond=0,
        tzinfo=timezone(timedelta(hours=2)),
    )

    trip = schema(
        **{**valid_trip_data(), "departure_at": departure_at},
    )

    assert trip.departure_at.tzinfo is None
    assert trip.departure_at.hour == 9


@pytest.mark.parametrize("schema", [TripCreate, TripUpdate])
def test_trip_rejects_timezone_aware_past_departure(schema):
    departure_at = datetime.now(timezone.utc) - timedelta(hours=1)

    with pytest.raises(ValidationError, match="cannot be in the past"):
        schema(
            **{**valid_trip_data(), "departure_at": departure_at},
        )

