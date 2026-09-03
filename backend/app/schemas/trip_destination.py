from pydantic import BaseModel


class TripDestinationCreate(BaseModel):
    location: str
    stop_order: int | None = None
    latitude: float | None = None
    longitude: float | None = None


class TripDestinationUpdate(BaseModel):
    location: str
    stop_order: int
    latitude: float | None = None
    longitude: float | None = None


class TripDestinationResponse(BaseModel):
    id: int
    trip_id: int
    location: str
    stop_order: int
    latitude: float | None
    longitude: float | None