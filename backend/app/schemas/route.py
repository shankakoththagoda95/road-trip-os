from enum import Enum

from pydantic import BaseModel


class RoutePreference(str, Enum):
    FASTEST = "fastest"
    SHORTEST = "shortest"


class TripRouteLegResponse(BaseModel):
    from_location: str
    to_location: str
    distance_meters: float
    duration_seconds: float


class TripRouteResponse(BaseModel):
    trip_id: int
    distance_meters: float
    duration_seconds: float
    legs: list[TripRouteLegResponse]