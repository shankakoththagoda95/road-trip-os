from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.itinerary import Itinerary
from app.models.itinerary_day import ItineraryDay
from app.models.trip import Trip
from app.models.trip_destination import TripDestination
from app.models.user import User
from app.services.itinerary import generate_itinerary_days


router = APIRouter(
    prefix="/itineraries",
    tags=["itineraries"],
)


@router.get("/test")
def test_itineraries():
    return {"message": "Itineraries API is working!"}


@router.post("/trips/{trip_id}/itinerary")
def create_itinerary(
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
        .where(TripDestination.trip_id == trip.id)
        .order_by(TripDestination.stop_order)
    ).all()

    try:
        route, days = generate_itinerary_days(
            trip,
            destinations,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    itinerary = Itinerary(
        trip_id=trip.id,
    )

    db.add(itinerary)
    db.flush()

    for day in days:
        itinerary_day = ItineraryDay(
            itinerary_id=itinerary.id,
            day_number=day.day_number,
            total_distance_meters=day.total_distance_meters,
            total_duration_seconds=day.total_duration_seconds,
            distance_status=day.distance_status,
            driving_time_status=day.driving_time_status,
        )

        db.add(itinerary_day)

    db.commit()

    return {
        "message": "Route split into driving days successfully",
        "trip_id": trip.id,
        "distance_meters": route["distance_meters"],
        "duration_seconds": route["duration_seconds"],
        "days": [
            {
                "day_number": day.day_number,
                "total_distance_meters": day.total_distance_meters,
                "total_duration_seconds": day.total_duration_seconds,
                "distance_status": day.distance_status,
                "driving_time_status": day.driving_time_status,
                "legs": day.legs,
            }
            for day in days
        ],
    }


@router.get("/trips/{trip_id}/itinerary")
def get_itinerary(
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

    itinerary = db.scalar(
        select(Itinerary)
        .where(Itinerary.trip_id == trip.id)
        .order_by(Itinerary.id.desc())
    )

    if itinerary is None:
        raise HTTPException(
            status_code=404,
            detail="Itinerary not found",
        )

    days = db.scalars(
        select(ItineraryDay)
        .where(ItineraryDay.itinerary_id == itinerary.id)
        .order_by(ItineraryDay.day_number)
    ).all()

    return {
        "id": itinerary.id,
        "trip_id": itinerary.trip_id,
        "created_at": itinerary.created_at,
        "updated_at": itinerary.updated_at,
        "days": [
            {
                "id": day.id,
                "itinerary_id": day.itinerary_id,
                "day_number": day.day_number,
                "total_distance_meters": day.total_distance_meters,
                "total_duration_seconds": day.total_duration_seconds,
                "distance_status": day.distance_status,
                "driving_time_status": day.driving_time_status,
            }
            for day in days
        ],
    }