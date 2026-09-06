from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.trip import Trip
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.trip import TripCreate, TripResponse, TripUpdate
from app.schemas.route import RoutePreference, TripRouteResponse
from app.services.route_constraints import check_distance_limit
from app.services.trip_route import calculate_trip_route_details
from app.models.trip_destination import TripDestination
from app.schemas.fuel import TripFuelEstimateResponse
from app.services.fuel import calculate_trip_fuel_cost
from app.models.trip_location import TripLocation
from app.schemas.trip_location import TripLocationCreate, TripLocationResponse
from app.models.trip_location import TripLocation
from app.schemas.fuel_range import TripFuelStatusResponse
from app.services.fuel_tracking import estimate_fuel_remaining
from app.models.trip_fuel import TripFuel
from app.models.user_settings import UserSettings


router = APIRouter(
    prefix="/trips",
    tags=["trips"],
)


@router.post("/", response_model=TripResponse)
def create_trip(
    trip_data: TripCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if trip_data.vehicle_id is not None:
        vehicle = db.scalar(
            select(Vehicle).where(
                Vehicle.id == trip_data.vehicle_id,
                Vehicle.user_id == current_user.id,
            )
        )

        if vehicle is None:
            raise HTTPException(
                status_code=404,
                detail="Vehicle not found",
            )
    
    new_trip = Trip(
        user_id=current_user.id,
        name=trip_data.name,
        start_location=trip_data.start_location,
        destination=trip_data.destination,
        trip_type=trip_data.trip_type,
        departure_at=trip_data.departure_at,
        travelers=trip_data.travelers,
        duration_days=trip_data.duration_days,
        vehicle_id=trip_data.vehicle_id,
        max_driving_hours_per_day=trip_data.max_driving_hours_per_day,
        max_distance_per_day=trip_data.max_distance_per_day,
    )

    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)

    return new_trip


@router.get("/", response_model=list[TripResponse])
def get_my_trips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    trips = db.scalars(
        select(Trip)
        .where(Trip.user_id == current_user.id)
        .order_by(Trip.id)
    ).all()

    return trips


@router.get("/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
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

    return trip


@router.post(
    "/{trip_id}/locations",
    response_model=TripLocationResponse,
)
def record_trip_location(
    trip_id: int,
    location: TripLocationCreate,
    current_user: User = Depends(get_current_user),
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

    trip_location = TripLocation(
        trip_id=trip.id,
        latitude=location.latitude,
        longitude=location.longitude,
        recorded_at=datetime.utcnow(),
    )

    db.add(trip_location)
    db.flush()

    trip_fuel = db.scalar(
        select(TripFuel).where(
            TripFuel.trip_id == trip.id,
        )
    )

    if trip_fuel is None:
        db.commit()
        db.refresh(trip_location)
        return trip_location

    if trip.vehicle_id is None:
        db.commit()
        db.refresh(trip_location)
        return trip_location

    vehicle = db.scalar(
        select(Vehicle).where(
            Vehicle.id == trip.vehicle_id,
            Vehicle.user_id == current_user.id,
        )
    )

    if vehicle is None or vehicle.fuel_consumption is None:
        db.commit()
        db.refresh(trip_location)
        return trip_location

    settings = db.scalar(
        select(UserSettings).where(
            UserSettings.user_id == current_user.id,
        )
    )

    threshold_meters = (
        settings.gps_movement_threshold_meters
        if settings is not None
        else 20.0
    )

    locations = db.scalars(
        select(TripLocation)
        .where(TripLocation.trip_id == trip.id)
        .order_by(TripLocation.recorded_at)
    ).all()

    coordinates = [
        (item.latitude, item.longitude)
        for item in locations
    ]

    (
        _distance_traveled_km,
        fuel_remaining,
        _remaining_range_km,
    ) = estimate_fuel_remaining(
        coordinates=coordinates,
        starting_fuel=trip_fuel.starting_fuel,
        consumption_l_per_100km=vehicle.fuel_consumption,
        threshold_meters=threshold_meters,
    )

    trip_fuel.current_fuel = fuel_remaining
    trip_fuel.fuel_used = (
        trip_fuel.starting_fuel - fuel_remaining
    )

    db.commit()
    db.refresh(trip_location)

    return trip_location


@router.put("/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: int,
    trip_data: TripUpdate,
    current_user: User = Depends(get_current_user),
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

    if trip_data.vehicle_id is not None:
        vehicle = db.scalar(
            select(Vehicle).where(
                Vehicle.id == trip_data.vehicle_id,
                Vehicle.user_id == current_user.id,
            )
        )
    
        if vehicle is None:
            raise HTTPException(
                status_code=404,
                detail="Vehicle not found",
            )

    trip.name = trip_data.name
    trip.start_location = trip_data.start_location
    trip.destination = trip_data.destination
    trip.trip_type = trip_data.trip_type
    trip.departure_at = trip_data.departure_at
    trip.travelers = trip_data.travelers
    trip.duration_days = trip_data.duration_days
    trip.max_driving_hours_per_day = trip_data.max_driving_hours_per_day
    trip.max_distance_per_day = trip_data.max_distance_per_day
    trip.vehicle_id = trip_data.vehicle_id

    db.commit()
    db.refresh(trip)

    return trip


@router.delete("/{trip_id}")
def delete_trip(
    trip_id: int,
    current_user: User = Depends(get_current_user),
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

    db.delete(trip)
    db.commit()

    return {"message": "Trip deleted successfully"}


@router.get(
    "/{trip_id}/fuel-estimate",
    response_model=TripFuelEstimateResponse,
)
def get_trip_fuel_estimate(
    trip_id: int,
    fuel_price_per_liter: float,
    current_user: User = Depends(get_current_user),
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

    settings = db.scalar(
        select(UserSettings).where(
            UserSettings.user_id == current_user.id,
        )
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

    if vehicle.fuel_consumption is None:
        raise HTTPException(
            status_code=400,
            detail="Vehicle does not have fuel consumption data",
        )
    
    distance_km = route_details["route"]["distance_meters"] / 1000
    
    fuel_required, fuel_cost = calculate_trip_fuel_cost(
        distance_km=distance_km,
        consumption_l_per_100km=vehicle.fuel_consumption,
        fuel_price_per_liter=fuel_price_per_liter,
    )

    return {
        "trip_id": trip.id,
        "distance_km": distance_km,
        "fuel_required": fuel_required,
        "fuel_price_per_liter": fuel_price_per_liter,
        "estimated_fuel_cost": fuel_cost,
    }


@router.get(
    "/{trip_id}/fuel-status",
    response_model=TripFuelStatusResponse,
)
def get_trip_fuel_status(
    trip_id: int,
    current_user: User = Depends(get_current_user),
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

    settings = db.scalar(
        select(UserSettings).where(
            UserSettings.user_id == current_user.id,
        )
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

    if vehicle.fuel_consumption is None:
        raise HTTPException(
            status_code=400,
            detail="Vehicle does not have fuel consumption data",
        )

    trip_fuel = db.scalar(
        select(TripFuel).where(
            TripFuel.trip_id == trip.id,
        )
    )

    if trip_fuel is None:
        raise HTTPException(
            status_code=400,
            detail="Trip does not have starting fuel data",
        )

    locations = db.scalars(
        select(TripLocation)
        .where(TripLocation.trip_id == trip.id)
        .order_by(TripLocation.recorded_at)
    ).all()

    coordinates = [
        (location.latitude, location.longitude)
        for location in locations
    ]

    (
        distance_traveled_km,
        fuel_remaining,
        remaining_range_km,
    ) = estimate_fuel_remaining(
            coordinates=coordinates,
            starting_fuel=trip_fuel.starting_fuel,
            consumption_l_per_100km=vehicle.fuel_consumption,
            threshold_meters=(
                settings.gps_movement_threshold_meters
                if settings is not None
                else 20.0
            ),
        )

    return {
        "trip_id": trip.id,
        "distance_traveled_km": distance_traveled_km,
        "fuel_remaining": fuel_remaining,
        "remaining_range_km": remaining_range_km,
    }


@router.get(
    "/{trip_id}/route",
    response_model=TripRouteResponse,
)
def calculate_trip_route_endpoint(
    trip_id: int,
    preference: RoutePreference = RoutePreference.FASTEST,
    current_user: User = Depends(get_current_user),
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

    destinations = db.scalars(
        select(TripDestination)
        .where(TripDestination.trip_id == trip_id)
        .order_by(TripDestination.stop_order)
    ).all()

    try:
        route_details = calculate_trip_route_details(
            trip,
            destinations,
            preference,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    route = route_details["route"]
    locations = route_details["locations"]
    legs = route_details["legs"]
    days = route_details["days"]

    return {
        "trip_id": trip.id,
        "locations": locations,
        "distance_meters": route["distance_meters"],
        "duration_seconds": route["duration_seconds"],
        "legs": [
            {
                "from_location": locations[index],
                "to_location": locations[index + 1],
                "distance_meters": leg["distance_meters"],
                "duration_seconds": leg["duration_seconds"],
                "distance_status": check_distance_limit(
                    leg["distance_meters"],
                    trip.max_distance_per_day,
                ),
            }
            for index, leg in enumerate(route["legs"])
        ],
        "days": [
            {
                "day_number": day.day_number,
                "total_distance_meters": day.total_distance_meters,
                "total_duration_seconds": day.total_duration_seconds,
                "driving_time_status": day.driving_time_status,
                "distance_status": day.distance_status,
                "legs": [
                    {
                        "from_location": leg["from_location"],
                        "to_location": leg["to_location"],
                        "distance_meters": leg["distance_meters"],
                        "duration_seconds": leg["duration_seconds"],
                        "distance_status": check_distance_limit(
                            leg["distance_meters"],
                            trip.max_distance_per_day,
                        ),
                    }
                    for leg in day.legs
                ],
            }
            for day in days
        ],
    }