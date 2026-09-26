from pydantic import BaseModel, Field

from app.schemas.trip import MAX_STAY_NIGHTS


class TripDestinationCreate(BaseModel):
    location: str
    stop_order: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    # Nights spent here before driving on.
    nights: int = Field(default=0, ge=0, le=MAX_STAY_NIGHTS)


class TripDestinationUpdate(BaseModel):
    location: str
    stop_order: int
    latitude: float | None = None
    longitude: float | None = None
    nights: int = Field(default=0, ge=0, le=MAX_STAY_NIGHTS)


class TripDestinationResponse(BaseModel):
    id: int
    trip_id: int
    location: str
    stop_order: int
    latitude: float | None
    longitude: float | None
    nights: int