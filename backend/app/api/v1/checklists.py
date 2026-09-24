from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.trip_checklist import (
    TripChecklistRequest,
    TripChecklistResponse,
)
from app.services.trip_checklist import build_trip_checklist


router = APIRouter(
    prefix="/checklists",
    tags=["checklists"],
)


@router.post(
    "/",
    response_model=TripChecklistResponse,
)
def generate_checklist(
    request: TripChecklistRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Documents, fees, equipment and rules for the countries on a trip.
    """

    items = build_trip_checklist(
        country_codes=request.country_codes,
        departure=request.departure_date,
        duration_days=request.duration_days,
        vehicle_type=request.vehicle_type,
        fuel_type=request.fuel_type,
    )

    return {"items": [asdict(item) for item in items]}
