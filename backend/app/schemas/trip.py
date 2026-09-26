from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, field_validator


# Longest stay at one place on a trip.
MAX_STAY_NIGHTS = 90


class TripType(str, Enum):
    ONE_WAY = "one_way"
    ROUND_TRIP = "round_trip"

def validate_departure(value: datetime) -> datetime:
    """
    Rejects past departures and returns a naive datetime.

    Departure times are stored as local wall-clock time (no timezone).
    A timezone-aware value keeps its local time and drops the offset,
    so "09:00+02:00" is stored as 09:00.
    """
    if value.tzinfo is None:
        is_past = value < datetime.now()
    else:
        is_past = value < datetime.now(timezone.utc)

    if is_past:
        raise ValueError("Departure time cannot be in the past")

    return value.replace(tzinfo=None)


class TripCreate(BaseModel):
    name: str
    start_location: str
    destination: str
    trip_type: TripType
    departure_at: datetime
    travelers: int = Field(ge=1)
    duration_days: int = Field(ge=1)
    # Nights at the destination (the last stop).
    destination_nights: int = Field(default=0, ge=0, le=MAX_STAY_NIGHTS)
    vehicle_id: int | None = Field(default=None, gt=0)
    max_driving_hours_per_day: float | None = Field(default=None, ge=0)
    max_distance_per_day: float | None = Field(default=None, ge=0)

    @field_validator("departure_at")
    @classmethod
    def validate_departure_at(cls, value: datetime) -> datetime:
        return validate_departure(value)


class TripUpdate(BaseModel):
    name: str
    start_location: str
    destination: str
    trip_type: TripType
    departure_at: datetime
    travelers: int = Field(ge=1)
    duration_days: int = Field(ge=1)
    # Nights at the destination (the last stop).
    destination_nights: int = Field(default=0, ge=0, le=MAX_STAY_NIGHTS)
    vehicle_id: int | None = Field(default=None, gt=0)
    max_driving_hours_per_day: float | None = Field(default=None, ge=0)
    max_distance_per_day: float | None = Field(default=None, ge=0)

    @field_validator("departure_at")
    @classmethod
    def validate_departure_at(cls, value: datetime) -> datetime:
        return validate_departure(value)


class TripResponse(BaseModel):
    id: int
    user_id: int
    name: str
    start_location: str
    destination: str
    trip_type: TripType
    departure_at: datetime
    travelers: int
    duration_days: int
    destination_nights: int
    vehicle_id: int | None
    max_driving_hours_per_day: float | None
    max_distance_per_day: float | None