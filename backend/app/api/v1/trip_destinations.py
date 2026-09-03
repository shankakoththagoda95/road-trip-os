from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.services.geocoding import geocode_location

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.trip import Trip
from app.models.trip_destination import TripDestination
from app.models.user import User
from app.schemas.trip_destination import (
    TripDestinationCreate,
    TripDestinationResponse,
    TripDestinationUpdate,
)


router = APIRouter(
    prefix="/trips/{trip_id}/destinations",
    tags=["trip destinations"],
)


@router.post("/", response_model=TripDestinationResponse)
def create_destination(
    trip_id: int,
    destination_data: TripDestinationCreate,
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

    highest_stop_order = db.scalar(
        select(TripDestination.stop_order)
        .where(TripDestination.trip_id == trip_id)
        .order_by(TripDestination.stop_order.desc())
        .limit(1)
    )

    next_stop_order = (
        highest_stop_order + 1
        if highest_stop_order is not None
        else 1
    )

    latitude = destination_data.latitude
    longitude = destination_data.longitude

    if latitude is None or longitude is None:
        try:
            latitude, longitude = geocode_location(
                destination_data.location
            )
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=str(error),
            )

    new_destination = TripDestination(
        trip_id=trip_id,
        location=destination_data.location,
        stop_order=(
            destination_data.stop_order
            if destination_data.stop_order is not None
            else next_stop_order
        ),
        latitude=latitude,
        longitude=longitude,
    )

    db.add(new_destination)
    db.commit()
    db.refresh(new_destination)

    return new_destination


@router.get("/", response_model=list[TripDestinationResponse])
def get_trip_destinations(
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

    return destinations


@router.get("/{destination_id}", response_model=TripDestinationResponse)
def get_destination(
    trip_id: int,
    destination_id: int,
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

    destination = db.scalar(
        select(TripDestination).where(
            TripDestination.id == destination_id,
            TripDestination.trip_id == trip_id,
        )
    )

    if destination is None:
        raise HTTPException(
            status_code=404,
            detail="Destination not found",
        )

    return destination


@router.put("/{destination_id}", response_model=TripDestinationResponse)
def update_destination(
    trip_id: int,
    destination_id: int,
    destination_data: TripDestinationUpdate,
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

    destination = db.scalar(
        select(TripDestination).where(
            TripDestination.id == destination_id,
            TripDestination.trip_id == trip_id,
        )
    )

    if destination is None:
        raise HTTPException(
            status_code=404,
            detail="Destination not found",
        )

    destination.location = destination_data.location
    destination.stop_order = destination_data.stop_order
    
    latitude = destination_data.latitude
    longitude = destination_data.longitude
    
    if latitude is None or longitude is None:
        try:
            latitude, longitude = geocode_location(
                destination_data.location
            )
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=str(error),
            )
    
    destination.latitude = latitude
    destination.longitude = longitude

    db.commit()
    db.refresh(destination)

    return destination


@router.delete("/{destination_id}")
def delete_destination(
    trip_id: int,
    destination_id: int,
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

    destination = db.scalar(
        select(TripDestination).where(
            TripDestination.id == destination_id,
            TripDestination.trip_id == trip_id,
        )
    )

    if destination is None:
        raise HTTPException(
            status_code=404,
            detail="Destination not found",
        )

    db.delete(destination)
    db.commit()

    return {"message": "Destination deleted successfully"}