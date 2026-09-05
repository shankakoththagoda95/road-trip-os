from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class TripType(str, Enum):
    ONE_WAY = "one_way"
    ROUND_TRIP = "round_trip"

class TripCreate(BaseModel):
    name: str
    start_location: str
    destination: str
    trip_type: TripType
    departure_at: datetime
    travelers: int = Field(ge=1)
    duration_days: int = Field(ge=1)
    vehicle_id: int | None = Field(default=None, gt=0)
    max_driving_hours_per_day: float | None = Field(default=None, ge=0)
    max_distance_per_day: float | None = Field(default=None, ge=0)

    @field_validator("departure_at")
    @classmethod
    def validate_departure_at(cls, value: datetime) -> datetime:
        if value < datetime.now():
            raise ValueError("Departure time cannot be in the past")

        return value


class TripUpdate(BaseModel):
    name: str
    start_location: str
    destination: str
    trip_type: TripType
    departure_at: datetime
    travelers: int = Field(ge=1)
    duration_days: int = Field(ge=1)
    vehicle_id: int | None = Field(default=None, gt=0)
    max_driving_hours_per_day: float | None = Field(default=None, ge=0)
    max_distance_per_day: float | None = Field(default=None, ge=0)

    @field_validator("departure_at")
    @classmethod
    def validate_departure_at(cls, value: datetime) -> datetime:
        if value < datetime.now():
            raise ValueError("Departure time cannot be in the past")
    
        return value


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
    vehicle_id: int | None
    max_driving_hours_per_day: float | None
    max_distance_per_day: float | None