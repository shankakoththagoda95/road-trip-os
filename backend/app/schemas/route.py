from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.trip import TripType
from app.services.route_constraints import (
    DistanceStatus,
    DrivingTimeStatus,
)


class RoutePreference(str, Enum):
    FASTEST = "fastest"
    SHORTEST = "shortest"


class RouteGeometry(BaseModel):
    """
    GeoJSON LineString. Coordinates are [longitude, latitude].
    """

    type: Literal["LineString"] = "LineString"
    coordinates: list[list[float]]


class TripRouteLegResponse(BaseModel):
    from_location: str
    to_location: str
    distance_meters: float
    duration_seconds: float
    distance_status: DistanceStatus


class DrivingDayResponse(BaseModel):
    day_number: int
    total_distance_meters: float
    total_duration_seconds: float
    distance_status: DistanceStatus
    driving_time_status: DrivingTimeStatus
    legs: list[TripRouteLegResponse]


class TripRouteResponse(BaseModel):
    trip_id: int
    distance_meters: float
    duration_seconds: float
    legs: list[TripRouteLegResponse]
    days: list[DrivingDayResponse]
    geometry: RouteGeometry | None = None


class GeocodeRequest(BaseModel):
    query: str = Field(
        min_length=1,
        pattern=r".*\S.*",
    )


class GeocodeResponse(BaseModel):
    query: str
    display_name: str
    latitude: float
    longitude: float


class RoutePointInput(BaseModel):
    """
    A location on the route. Coordinates are looked up when omitted.
    """

    location: str = Field(
        min_length=1,
        pattern=r".*\S.*",
    )
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class RoutePreviewRequest(BaseModel):
    start: RoutePointInput
    destination: RoutePointInput
    stops: list[RoutePointInput] = Field(default_factory=list)
    trip_type: TripType = TripType.ONE_WAY
    preference: RoutePreference = RoutePreference.FASTEST


class RoutePointKind(str, Enum):
    START = "start"
    STOP = "stop"
    DESTINATION = "destination"


class RoutePoint(BaseModel):
    location: str
    latitude: float
    longitude: float
    kind: RoutePointKind


class RoutePreviewLeg(BaseModel):
    from_location: str
    to_location: str
    distance_meters: float
    duration_seconds: float


class RoutePreviewResponse(BaseModel):
    distance_meters: float
    duration_seconds: float
    points: list[RoutePoint]
    legs: list[RoutePreviewLeg]
    geometry: RouteGeometry
