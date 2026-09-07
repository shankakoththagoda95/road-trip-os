from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.models.user import User
from app.integrations.ev_charging import OpenChargeMapProvider
from app.schemas.ev_charging import (
    EVChargingStationResponse,
    EVChargingStationsNearbyRequest,
)

router = APIRouter(
    prefix="/ev-charging",
    tags=["EV Charging"],
)


@router.post(
    "/nearby",
    response_model=list[EVChargingStationResponse],
)
def nearby_ev_charging_stations(
    request: EVChargingStationsNearbyRequest,
    current_user: User = Depends(get_current_user),
):
    provider = OpenChargeMapProvider()

    stations = provider.search_nearby(
        latitude=request.latitude,
        longitude=request.longitude,
        radius_km=request.radius_km,
    )

    return [
        EVChargingStationResponse(
            provider_id=station.provider_id,
            name=station.name,
            latitude=station.latitude,
            longitude=station.longitude,
            country=station.country,
            operator=station.operator,
            connector_types=station.connector_types,
            charging_power_kw=station.charging_power_kw,
        )
        for station in stations
    ]