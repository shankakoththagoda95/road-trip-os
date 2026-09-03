from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.trip import Trip
from app.models.user import User
from app.schemas.trip import TripCreate, TripResponse, TripUpdate
from app.schemas.route import TripRouteResponse
from app.models.trip_destination import TripDestination
from app.services.route_builder import (
    calculate_trip_route,
    resolve_location,
)


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
    new_trip = Trip(
        user_id=current_user.id,
        name=trip_data.name,
        start_location=trip_data.start_location,
        destination=trip_data.destination,
        trip_type=trip_data.trip_type,
        departure_at=trip_data.departure_at,
        travelers=trip_data.travelers,
        duration_days=trip_data.duration_days,
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

    trip.name = trip_data.name
    trip.start_location = trip_data.start_location
    trip.destination = trip_data.destination
    trip.trip_type = trip_data.trip_type
    trip.departure_at = trip_data.departure_at
    trip.travelers = trip_data.travelers
    trip.duration_days = trip_data.duration_days
    trip.max_driving_hours_per_day = trip_data.max_driving_hours_per_day
    trip.max_distance_per_day = trip_data.max_distance_per_day

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
    "/{trip_id}/route",
    response_model=TripRouteResponse,
)
def calculate_trip_route_endpoint(
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

    destinations = db.scalars(
        select(TripDestination)
        .where(TripDestination.trip_id == trip_id)
        .order_by(TripDestination.stop_order)
    ).all()

    try:
        start_coordinates = resolve_location(
            trip.start_location
        )

        destination_coordinates = resolve_location(
            trip.destination
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
    for destination in destinations:
        if (
            destination.latitude is None
            or destination.longitude is None
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Destination '{destination.location}' "
                    "does not have valid coordinates"
                ),
            )


    stop_coordinates = [
        (destination.latitude, destination.longitude)
        for destination in destinations
    ]
    locations = [
        trip.start_location,
        *[
            destination.location
            for destination in destinations
        ],
        trip.destination,
    ]
    route = calculate_trip_route(
        start_coordinates,
        destination_coordinates,
        stop_coordinates,
    )

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
            }
            for index, leg in enumerate(route["legs"])
        ],
    }