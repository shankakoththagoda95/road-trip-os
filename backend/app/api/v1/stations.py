from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.integrations.ev_charging import EVChargingStation, OpenChargeMapProvider
from app.integrations.fuel_stations import OverpassFuelStationProvider
from app.models.user import User
from app.services.nearest_station import MAX_RADIUS_KM, find_nearest_expanding


router = APIRouter(
    prefix="/stations",
    tags=["stations"],
)


class NearestStationResponse(BaseModel):
    provider_id: str
    name: str
    latitude: float
    longitude: float
    # Straight-line distance from the search point.
    distance_km: float
    operator: str | None = None
    # Fuel stations: e.g. "diesel", "petrol_95". Chargers: connector names.
    details: list[str] = []
    # Chargers only: fastest connector.
    power_kw: float | None = None


class NearestStationsResponse(BaseModel):
    kind: Literal["fuel", "charging"]
    # Smallest whole-km radius with at least one station; null if none
    # within `searched_up_to_km`.
    radius_km: int | None
    searched_up_to_km: int
    stations: list[NearestStationResponse]


@router.get("/nearest", response_model=NearestStationsResponse)
def nearest_stations(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    kind: Literal["fuel", "charging"] = "fuel",
    max_radius_km: int = Query(default=MAX_RADIUS_KM, ge=1, le=MAX_RADIUS_KM),
    current_user: User = Depends(get_current_user),
):
    """
    The nearest fuel stations or chargers: the search radius grows 1 km at a
    time until at least one is found (up to `max_radius_km`).
    """

    if kind == "charging":
        try:
            provider = OpenChargeMapProvider()
        except RuntimeError:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "charging_not_configured",
                    "message": "Charger search isn't set up on the server.",
                },
            )
    else:
        provider = OverpassFuelStationProvider()

    result = find_nearest_expanding(
        provider,
        latitude=latitude,
        longitude=longitude,
        max_radius_km=max_radius_km,
    )

    if result is None:
        return NearestStationsResponse(
            kind=kind,
            radius_km=None,
            searched_up_to_km=max_radius_km,
            stations=[],
        )

    return NearestStationsResponse(
        kind=kind,
        radius_km=result.radius_km,
        searched_up_to_km=result.radius_km,
        stations=[_station(nearby.station, nearby.distance_km) for nearby in result.stations],
    )


def _station(station, distance_km: float) -> NearestStationResponse:
    if isinstance(station, EVChargingStation):
        return NearestStationResponse(
            provider_id=station.provider_id,
            name=station.name,
            latitude=station.latitude,
            longitude=station.longitude,
            distance_km=round(distance_km, 2),
            # Open Charge Map fills unknown operators with placeholders like
            # "(Business Owner at Location)".
            operator=(
                station.operator
                if station.operator and not station.operator.startswith("(")
                else None
            ),
            details=sorted(set(station.connector_types)),
            power_kw=station.charging_power_kw,
        )

    return NearestStationResponse(
        provider_id=station.provider_id,
        name=station.name,
        latitude=station.latitude,
        longitude=station.longitude,
        distance_km=round(distance_km, 2),
        details=station.fuel_types,
    )
