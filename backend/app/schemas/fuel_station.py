from pydantic import BaseModel
from pydantic import BaseModel, Field


class FuelStationResponse(BaseModel):
    provider_id: str
    name: str
    latitude: float
    longitude: float
    country: str | None
    fuel_types: list[str]


class RouteCoordinate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class FuelStationsAlongRouteRequest(BaseModel):
    route_coordinates: list[RouteCoordinate] = Field(min_length=1)
    search_radius_km: float = Field(
        default=2.0,
        gt=0,
    )


class FuelStationDetourResponse(BaseModel):
    detour_distance_km: float


class FuelStationRecommendationResponse(BaseModel):
    station: FuelStationResponse
    distance_km: float
    detour_distance_km: float
    reserve_km: float


class FuelStationRecommendationRequest(BaseModel):
    current_location: RouteCoordinate
    stations: list[FuelStationResponse]
    current_fuel: float = Field(ge=0)
    consumption_l_per_100km: float = Field(gt=0)
    reserve_km: float = Field(default=0.0, ge=0)