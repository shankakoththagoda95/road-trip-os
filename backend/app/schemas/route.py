from datetime import date, datetime
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


class RouteConditionsRequest(RoutePreviewRequest):
    # Local wall-clock time, like Trip.departure_at.
    departure_at: datetime
    max_driving_hours_per_day: float | None = Field(default=None, gt=0)


class DailyForecast(BaseModel):
    temperature_max_c: float
    temperature_min_c: float
    precipitation_probability: float
    wind_speed_max_kmh: float
    weather_code: int


class RoutePointWeather(BaseModel):
    location: str
    kind: RoutePointKind
    latitude: float
    longitude: float
    # Estimated day this point is reached.
    date: date
    # False when the date is beyond the forecast range or the lookup failed.
    forecast_available: bool
    forecast: DailyForecast | None


class TerrainSummaryResponse(BaseModel):
    total_ascent_m: float
    total_descent_m: float
    max_elevation_m: float
    min_elevation_m: float
    elevation_range_m: float


class ElevationProfilePoint(BaseModel):
    distance_km: float
    elevation_m: float


class RouteConditionsResponse(BaseModel):
    weather: list[RoutePointWeather]
    terrain: TerrainSummaryResponse | None
    elevation_profile: list[ElevationProfilePoint]
    warnings: list[str]
    # Data sources that failed, e.g. ["elevation"].
    unavailable: list[str]


class ItineraryPreviewRequest(RoutePreviewRequest):
    # Local wall-clock time, like Trip.departure_at.
    departure_at: datetime
    duration_days: int = Field(ge=1)
    max_distance_per_day: float | None = Field(default=None, gt=0)
    max_driving_hours_per_day: float | None = Field(default=None, gt=0)


class ItineraryPreviewDay(BaseModel):
    # Day of the trip, 1 = departure day.
    day_number: int
    date: date
    driving: bool
    # Where the day starts / ends; the same place on free days.
    from_location: str
    to_location: str
    distance_meters: float
    duration_seconds: float
    distance_status: DistanceStatus | None
    driving_time_status: DrivingTimeStatus | None
    legs: list[RoutePreviewLeg]


class ItineraryPreviewResponse(BaseModel):
    distance_meters: float
    duration_seconds: float
    days: list[ItineraryPreviewDay]
    driving_days: int
    # Why the plan doesn't work as-is, e.g. a leg longer than a day's limit.
    problems: list[str]


class RouteFeesRequest(RoutePreviewRequest):
    # Adds a note for heavier vehicles (e.g. campervans).
    vehicle_type: Literal["car", "motorcycle", "campervan", "van"] | None = None


class RouteCountryResponse(BaseModel):
    code: str
    name: str
    distance_km: float


class RouteBorderCrossingResponse(BaseModel):
    from_code: str
    from_country: str
    to_code: str
    to_country: str
    latitude: float
    longitude: float
    distance_from_start_km: float


class RoadFeeResponse(BaseModel):
    name: str
    country_code: str
    kind: Literal["vignette", "distance", "toll_stations", "crossing", "info"]
    # Approximate price in EUR; None for information-only entries.
    amount_eur: float | None
    note: str
    url: str | None


class RouteFeesResponse(BaseModel):
    countries: list[RouteCountryResponse]
    crossings: list[RouteBorderCrossingResponse]
    fees: list[RoadFeeResponse]
    total_eur: float
    notes: list[str]


class EnergyStopsRequest(RoutePreviewRequest):
    vehicle_id: int = Field(gt=0)
    start_level_percent: float = Field(default=100, gt=0, le=100)
    reserve_percent: float = Field(default=15, ge=0, le=50)
    # Defaults: 100% for fuel, 80% for EV charging.
    refill_to_percent: float | None = Field(default=None, gt=0, le=100)


class EnergyStationResponse(BaseModel):
    provider_id: str
    name: str
    latitude: float
    longitude: float
    details: list[str]


class EnergyStopResponse(BaseModel):
    distance_from_start_km: float
    latitude: float
    longitude: float
    station: EnergyStationResponse | None
    distance_from_route_km: float | None


class EnergyStopsResponse(BaseModel):
    mode: Literal["fuel", "ev"]
    full_range_km: float
    total_distance_km: float
    stops: list[EnergyStopResponse]
    warnings: list[str]
