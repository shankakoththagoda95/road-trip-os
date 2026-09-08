from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.trip import Trip
from app.models.trip_ev import TripEV
from app.models.user import User
from app.schemas.trip_ev import TripEVCreate, TripEVResponse


router = APIRouter(
    prefix="/trips/{trip_id}/ev",
    tags=["trip EV"],
)


@router.post("/", response_model=TripEVResponse)
def create_trip_ev(
    trip_id: int,
    ev_data: TripEVCreate,
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

    existing_ev = db.scalar(
        select(TripEV).where(
            TripEV.trip_id == trip_id,
        )
    )

    if existing_ev is not None:
        raise HTTPException(
            status_code=409,
            detail="EV data already exists for this trip",
        )

    new_ev = TripEV(
        trip_id=trip_id,
        starting_battery_percentage=ev_data.starting_battery_percentage,
        current_battery_percentage=ev_data.starting_battery_percentage,
    )

    db.add(new_ev)
    db.commit()
    db.refresh(new_ev)

    return new_ev