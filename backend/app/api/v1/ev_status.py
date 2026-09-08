from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.trip import Trip
from app.models.trip_ev import TripEV
from app.models.vehicle import Vehicle
from app.schemas.ev_status import TripEVStatusResponse
from app.services.ev import (
    calculate_charging_requirement,
    calculate_ev_range,
    calculate_usable_ev_range,
)
from app.models.trip_destination import TripDestination
from app.schemas.route import RoutePreference
from app.services.trip_route import calculate_trip_route_details

router = APIRouter(
    prefix="/trips/{trip_id}",
    tags=["trip EV"],
)


@router.get(
    "/ev-status",
    response_model=TripEVStatusResponse,
)
def get_ev_status(
    trip_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trip = db.scalar(
        select(Trip).where(
            Trip.id == trip_id,
            Trip.user_id == current_user.id,
        )
    )

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found",
        )

    if trip.vehicle_id is None:
        raise HTTPException(
            status_code=400,
            detail="Trip does not have a vehicle",
        )

    vehicle = db.scalar(
        select(Vehicle).where(
            Vehicle.id == trip.vehicle_id,
            Vehicle.user_id == current_user.id,
        )
    )

    if vehicle is None:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found",
        )

    if vehicle.fuel_type != "electric":
        raise HTTPException(
            status_code=400,
            detail="Trip vehicle is not electric",
        )

    trip_ev = db.scalar(
        select(TripEV).where(
            TripEV.trip_id == trip_id,
        )
    )

    if trip_ev is None:
        raise HTTPException(
            status_code=404,
            detail="EV data not found for this trip",
        )

    if (
        vehicle.battery_capacity is None
        or vehicle.energy_consumption is None
    ):
        raise HTTPException(
            status_code=400,
            detail="EV vehicle is missing battery information",
        )
    
    available_range_km = calculate_ev_range(
        battery_capacity_kwh=vehicle.battery_capacity,
        battery_percentage=trip_ev.current_battery_percentage,
        energy_consumption_kwh_per_100km=vehicle.energy_consumption,
    )

    usable_range_km = calculate_usable_ev_range(
        available_range_km=available_range_km,
    )

    destinations = db.scalars(
        select(TripDestination)
        .where(TripDestination.trip_id == trip_id)
        .order_by(TripDestination.stop_order)
    ).all()

    try:
        route_details = calculate_trip_route_details(
            trip,
            destinations,
            RoutePreference.FASTEST,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    route_distance_km = (
        route_details["route"]["distance_meters"] / 1000
    )

    charging_requirement = calculate_charging_requirement(
        available_range_km=usable_range_km,
        route_distance_km=route_distance_km,
    )
    
    return TripEVStatusResponse(
        trip_id=trip.id,
        battery_percentage=trip_ev.current_battery_percentage,
        available_range_km=available_range_km,
        usable_range_km=usable_range_km,
        route_distance_km=route_distance_km,
        needs_charging=charging_requirement.needs_charging,
        range_shortfall_km=charging_requirement.range_shortfall_km,
    )