from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.trip import Trip
from app.models.trip_fuel import TripFuel
from app.models.user import User
from app.schemas.trip_fuel import TripFuelCreate, TripFuelResponse


router = APIRouter(
    prefix="/trips/{trip_id}/fuel",
    tags=["trip fuel"],
)


@router.post("/", response_model=TripFuelResponse)
def create_trip_fuel(
    trip_id: int,
    fuel_data: TripFuelCreate,
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

    existing_fuel = db.scalar(
        select(TripFuel).where(
            TripFuel.trip_id == trip_id,
        )
    )

    if existing_fuel is not None:
        raise HTTPException(
            status_code=409,
            detail="Fuel data already exists for this trip",
        )

    new_fuel = TripFuel(
        trip_id=trip_id,
        starting_fuel=fuel_data.starting_fuel,
        current_fuel=fuel_data.current_fuel,
        fuel_used=fuel_data.fuel_used,
        fuel_cost=fuel_data.fuel_cost,
    )

    db.add(new_fuel)
    db.commit()
    db.refresh(new_fuel)

    return new_fuel