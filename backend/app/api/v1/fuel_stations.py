from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user
from app.integrations.fuel_stations import FuelStation, OverpassFuelStationProvider
from app.models.user import User
from app.schemas.fuel_station import (
    FuelStationResponse,
    FuelStationsAlongRouteRequest,
    FuelStationDetourResponse,
    FuelStationRecommendationRequest,
    FuelStationRecommendationResponse,
    RouteCoordinate,
)
from app.services.fuel_stations import FuelStationService


router = APIRouter(
    prefix="/fuel-stations",
    tags=["Fuel Stations"],
)


@router.get(
    "/nearby",
    response_model=list[FuelStationResponse],
)
def find_nearby_fuel_stations(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(..., gt=0),
    current_user: User = Depends(get_current_user),
):
    provider = OverpassFuelStationProvider()
    service = FuelStationService(provider)

    stations = service.find_nearby(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
    )

    return stations


@router.get(
    "/nearest",
    response_model=FuelStationResponse | None,
)
def find_nearest_fuel_station(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(..., gt=0),
    current_user: User = Depends(get_current_user),
):
    provider = OverpassFuelStationProvider()
    service = FuelStationService(provider)

    station = service.find_nearest(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
    )

    return station


@router.post(
    "/along-route",
    response_model=list[FuelStationResponse],
)
def find_fuel_stations_along_route(
    request: FuelStationsAlongRouteRequest,
    current_user: User = Depends(get_current_user),
):
    provider = OverpassFuelStationProvider()
    service = FuelStationService(provider)

    route_coordinates = [
        (coordinate.latitude, coordinate.longitude)
        for coordinate in request.route_coordinates
    ]

    stations = service.find_along_route(
        route_coordinates=route_coordinates,
        search_radius_km=request.search_radius_km,
    )

    return stations


@router.post(
    "/detour",
    response_model=FuelStationDetourResponse,
)
def calculate_fuel_station_detour(
    route_coordinates: list[RouteCoordinate],
    station: FuelStationResponse,
    current_user: User = Depends(get_current_user),
):
    provider = OverpassFuelStationProvider()
    service = FuelStationService(provider)

    coordinates = [
        (coordinate.latitude, coordinate.longitude)
        for coordinate in route_coordinates
    ]

    fuel_station = FuelStation(
        provider_id=station.provider_id,
        name=station.name,
        latitude=station.latitude,
        longitude=station.longitude,
        country=station.country,
        fuel_types=station.fuel_types,
    )

    detour_distance_km = service.calculate_detour_distance(
        route_coordinates=coordinates,
        station=fuel_station,
    )

    return FuelStationDetourResponse(
        detour_distance_km=detour_distance_km,
    )


@router.post(
    "/recommend",
    response_model=FuelStationRecommendationResponse | None,
)
def recommend_fuel_station(
    request: FuelStationRecommendationRequest,
    current_user: User = Depends(get_current_user),
):
    provider = OverpassFuelStationProvider()
    service = FuelStationService(provider)

    current_location = (
        request.current_location.latitude,
        request.current_location.longitude,
    )

    stations = [
        FuelStation(
            provider_id=station.provider_id,
            name=station.name,
            latitude=station.latitude,
            longitude=station.longitude,
            country=station.country,
            fuel_types=station.fuel_types,
        )
        for station in request.stations
    ]

    recommendation = service.recommend_fuel_station(
        current_location=current_location,
        stations=stations,
        current_fuel=request.current_fuel,
        consumption_l_per_100km=request.consumption_l_per_100km,
        reserve_km=request.reserve_km,
    )

    if recommendation is None:
        return None

    return FuelStationRecommendationResponse(
        station=FuelStationResponse(
            provider_id=recommendation.station.provider_id,
            name=recommendation.station.name,
            latitude=recommendation.station.latitude,
            longitude=recommendation.station.longitude,
            country=recommendation.station.country,
            fuel_types=recommendation.station.fuel_types,
        ),
        distance_km=recommendation.distance_km,
        detour_distance_km=recommendation.detour_distance_km,
        reserve_km=recommendation.reserve_km,
    )