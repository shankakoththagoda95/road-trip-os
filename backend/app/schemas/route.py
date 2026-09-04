from enum import Enum

from pydantic import BaseModel

from app.services.route_constraints import DistanceStatus


class RoutePreference(str, Enum):
    FASTEST = "fastest"
    SHORTEST = "shortest"


class TripRouteLegResponse(BaseModel):
    from_location: str
    to_location: str
    distance_meters: float
    duration_seconds: float
    distance_status: DistanceStatus


class DrivingDayResponse(BaseModel):
    day_number: int
    total_distance_meters: float
    distance_status: DistanceStatus


class TripRouteResponse(BaseModel):
    trip_id: int
    distance_meters: float
    duration_seconds: float
    legs: list[TripRouteLegResponse]
    days: list[DrivingDayResponse]