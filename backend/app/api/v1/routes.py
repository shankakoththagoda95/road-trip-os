from dataclasses import asdict
from datetime import date

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.integrations.countries import get_country_locator
from app.integrations.elevation import OpenMeteoElevationProvider
from app.integrations.ev_charging import OpenChargeMapProvider
from app.integrations.fuel_stations import OverpassFuelStationProvider
from app.integrations.weather import OpenMeteoWeatherProvider
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.route import (
    EnergyStopsRequest,
    EnergyStopsResponse,
    GeocodeRequest,
    GeocodeResponse,
    ItineraryPreviewRequest,
    ItineraryPreviewResponse,
    RouteConditionsRequest,
    RouteConditionsResponse,
    RouteFeesRequest,
    RouteFeesResponse,
    RoutePreviewRequest,
    RoutePreviewResponse,
)
from app.services.energy_stops import (
    EnergyStation,
    StationFinder,
    plan_energy_stops,
    vehicle_energy_profile,
)
from app.services.geocoding import reverse_country_code, search_location
from app.services.itinerary_preview import preview_itinerary
from app.services.road_fees import HEAVY_VEHICLE_NOTE, calculate_road_fees
from app.services.route_conditions import build_route_conditions
from app.services.route_countries import country_stretches, throttled
from app.services.route_preview import preview_route


router = APIRouter(
    prefix="/routes",
    tags=["routes"],
)

# Search radius around each planned stop point.
FUEL_SEARCH_RADIUS_KM = 5.0
EV_SEARCH_RADIUS_KM = 10.0

FUEL_TYPE_LABELS = {
    "diesel": "diesel",
    "petrol_95": "petrol 95",
    "e10": "E10",
}


@router.post(
    "/geocode",
    response_model=GeocodeResponse,
)
def geocode(
    request: GeocodeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Look up one location by name (best match only).
    """

    query = request.query.strip()

    try:
        result = search_location(query)
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Location service is unavailable. Try again shortly.",
        )

    return {
        "query": query,
        **result,
    }


@router.post(
    "/preview",
    response_model=RoutePreviewResponse,
)
def preview(
    request: RoutePreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Calculate a route before the trip is saved (used while planning).
    """

    try:
        return preview_route(request)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Routing service is unavailable. Try again shortly.",
        )


def fuel_station_finder() -> StationFinder:
    provider = OverpassFuelStationProvider()

    def find(latitude: float, longitude: float) -> list[EnergyStation]:
        return [
            EnergyStation(
                provider_id=station.provider_id,
                name=station.name,
                latitude=station.latitude,
                longitude=station.longitude,
                details=[
                    FUEL_TYPE_LABELS.get(fuel_type, fuel_type)
                    for fuel_type in station.fuel_types
                ],
            )
            for station in provider.search_nearby(
                latitude=latitude,
                longitude=longitude,
                radius_km=FUEL_SEARCH_RADIUS_KM,
            )
        ]

    return find


def ev_station_finder() -> StationFinder:
    provider = OpenChargeMapProvider()

    def find(latitude: float, longitude: float) -> list[EnergyStation]:
        return [
            EnergyStation(
                provider_id=station.provider_id,
                name=station.name,
                latitude=station.latitude,
                longitude=station.longitude,
                details=[
                    detail
                    for detail in [
                        (
                            f"{station.charging_power_kw:g} kW"
                            if station.charging_power_kw
                            else None
                        ),
                        station.operator,
                        *sorted(set(station.connector_types))[:3],
                    ]
                    if detail
                ],
            )
            for station in provider.search_nearby(
                latitude=latitude,
                longitude=longitude,
                radius_km=EV_SEARCH_RADIUS_KM,
            )
        ]

    return find


@router.post(
    "/energy-stops",
    response_model=EnergyStopsResponse,
)
def energy_stops(
    request: EnergyStopsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Plan fuel or charging stops along a route for one of the user's
    vehicles.
    """

    vehicle = db.scalar(
        select(Vehicle).where(
            Vehicle.id == request.vehicle_id,
            Vehicle.user_id == current_user.id,
        )
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    try:
        profile = vehicle_energy_profile(
            vehicle,
            start_level_percent=request.start_level_percent,
            reserve_percent=request.reserve_percent,
            refill_to_percent=request.refill_to_percent,
        )

        route = preview_route(request)
        route_coordinates = [
            (latitude, longitude)
            for longitude, latitude in route["geometry"]["coordinates"]
        ]

        find_stations = (
            ev_station_finder()
            if profile.mode == "ev"
            else fuel_station_finder()
        )

        plan = plan_energy_stops(
            route_coordinates,
            profile,
            find_stations,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
    except RuntimeError:
        # e.g. OPEN_CHARGE_MAP_API_KEY is not configured.
        raise HTTPException(
            status_code=503,
            detail="Station search is not configured on the server.",
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Station search is unavailable. Try again shortly.",
        )

    return {
        "mode": profile.mode,
        "full_range_km": profile.full_range_km,
        "total_distance_km": plan.total_distance_km,
        "stops": [asdict(stop) for stop in plan.stops],
        "warnings": plan.warnings,
    }


@router.post(
    "/conditions",
    response_model=RouteConditionsResponse,
)
def conditions(
    request: RouteConditionsRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Weather along the route on the days it's driven, plus terrain.
    """

    try:
        route = preview_route(request)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Routing service is unavailable. Try again shortly.",
        )

    return build_route_conditions(
        route,
        departure_at=request.departure_at,
        max_driving_hours_per_day=request.max_driving_hours_per_day,
        weather_provider=OpenMeteoWeatherProvider(),
        elevation_provider=OpenMeteoElevationProvider(),
        today=date.today(),
    )


@router.post(
    "/fees",
    response_model=RouteFeesResponse,
)
def fees(
    request: RouteFeesRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Countries, border crossings and approximate road fees along a route.
    """

    try:
        route = preview_route(request)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Routing service is unavailable. Try again shortly.",
        )

    route_coordinates = [
        (latitude, longitude)
        for longitude, latitude in route["geometry"]["coordinates"]
    ]

    stretches = country_stretches(
        route_coordinates,
        get_country_locator(),
        verify_country=throttled(reverse_country_code),
    )
    road_fees = calculate_road_fees(stretches, route_coordinates)

    # Distance per country, in order of first entry.
    countries: dict[str, dict] = {}

    for stretch in stretches:
        entry = countries.setdefault(
            stretch.country.code,
            {
                "code": stretch.country.code,
                "name": stretch.country.name,
                "distance_km": 0.0,
            },
        )
        entry["distance_km"] += stretch.distance_km

    crossings = [
        {
            "from_code": previous.country.code,
            "from_country": previous.country.name,
            "to_code": current.country.code,
            "to_country": current.country.name,
            "latitude": current.entry_point[0],
            "longitude": current.entry_point[1],
            "distance_from_start_km": current.start_km,
        }
        for previous, current in zip(stretches, stretches[1:])
    ]

    notes = []

    if request.vehicle_type == "campervan":
        notes.append(HEAVY_VEHICLE_NOTE)

    if request.vehicle_type == "motorcycle":
        notes.append(
            "Motorcycles often pay less (e.g. cheaper vignettes); these "
            "estimates are for cars."
        )

    return {
        "countries": list(countries.values()),
        "crossings": crossings,
        "fees": [asdict(fee) for fee in road_fees],
        "total_eur": round(
            sum(fee.amount_eur or 0 for fee in road_fees),
            2,
        ),
        "notes": notes,
    }


@router.post(
    "/itinerary",
    response_model=ItineraryPreviewResponse,
)
def itinerary(
    request: ItineraryPreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Day-by-day plan before the trip is saved: which days you drive, where
    you stay, and whether the daily limits work.
    """

    try:
        route = preview_route(request)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Routing service is unavailable. Try again shortly.",
        )

    return preview_itinerary(
        route,
        trip_type=request.trip_type,
        departure_at=request.departure_at,
        duration_days=request.duration_days,
        max_distance_per_day=request.max_distance_per_day,
        max_driving_hours_per_day=request.max_driving_hours_per_day,
    )
