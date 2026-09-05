from datetime import datetime

from pydantic import BaseModel, Field


class TripLocationCreate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class TripLocationResponse(BaseModel):
    id: int
    trip_id: int
    latitude: float
    longitude: float
    recorded_at: datetime