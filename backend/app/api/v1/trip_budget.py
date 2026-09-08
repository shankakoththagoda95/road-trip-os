from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.trip import Trip
from app.models.trip_budget import TripBudget
from app.models.user import User
from app.schemas.trip_budget import (
    TripBudgetCreate,
    TripBudgetResponse,
)
from app.services.trip_budget import (
    calculate_actual_total,
    calculate_estimated_total,
)

router = APIRouter(
    prefix="/trips/{trip_id}/budget",
    tags=["trip budget"],
)


@router.post(
    "/",
    response_model=TripBudgetResponse,
)
def create_trip_budget(
    trip_id: int,
    budget_data: TripBudgetCreate,
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

    existing_budget = db.scalar(
        select(TripBudget).where(
            TripBudget.trip_id == trip_id,
        )
    )

    if existing_budget is not None:
        raise HTTPException(
            status_code=409,
            detail="Budget already exists for this trip",
        )

    estimated_total = calculate_estimated_total(
        estimated_fuel_cost=budget_data.estimated_fuel_cost,
        estimated_ev_charging_cost=budget_data.estimated_ev_charging_cost,
        estimated_toll_cost=budget_data.estimated_toll_cost,
        estimated_food_cost=budget_data.estimated_food_cost,
        estimated_parking_cost=budget_data.estimated_parking_cost,
        estimated_other_cost=budget_data.estimated_other_cost,
    )

    actual_total = calculate_actual_total(
        actual_fuel_cost=budget_data.actual_fuel_cost,
        actual_ev_charging_cost=budget_data.actual_ev_charging_cost,
        actual_toll_cost=budget_data.actual_toll_cost,
        actual_food_cost=budget_data.actual_food_cost,
        actual_parking_cost=budget_data.actual_parking_cost,
        actual_other_cost=budget_data.actual_other_cost,
    )

    remaining_budget = estimated_total - actual_total

    budget = TripBudget(
        trip_id=trip_id,
        currency=budget_data.currency,
        estimated_fuel_cost=budget_data.estimated_fuel_cost,
        estimated_ev_charging_cost=budget_data.estimated_ev_charging_cost,
        estimated_toll_cost=budget_data.estimated_toll_cost,
        estimated_food_cost=budget_data.estimated_food_cost,
        estimated_parking_cost=budget_data.estimated_parking_cost,
        estimated_other_cost=budget_data.estimated_other_cost,
        actual_fuel_cost=budget_data.actual_fuel_cost,
        actual_ev_charging_cost=budget_data.actual_ev_charging_cost,
        actual_toll_cost=budget_data.actual_toll_cost,
        actual_food_cost=budget_data.actual_food_cost,
        actual_parking_cost=budget_data.actual_parking_cost,
        actual_other_cost=budget_data.actual_other_cost,
    )

    db.add(budget)
    db.commit()
    db.refresh(budget)

    return {
        "id": budget.id,
        "trip_id": budget.trip_id,
        "currency": budget.currency,
        "estimated_fuel_cost": budget.estimated_fuel_cost,
        "estimated_ev_charging_cost": budget.estimated_ev_charging_cost,
        "estimated_toll_cost": budget.estimated_toll_cost,
        "estimated_food_cost": budget.estimated_food_cost,
        "estimated_parking_cost": budget.estimated_parking_cost,
        "estimated_other_cost": budget.estimated_other_cost,
        "actual_fuel_cost": budget.actual_fuel_cost,
        "actual_ev_charging_cost": budget.actual_ev_charging_cost,
        "actual_toll_cost": budget.actual_toll_cost,
        "actual_food_cost": budget.actual_food_cost,
        "actual_parking_cost": budget.actual_parking_cost,
        "actual_other_cost": budget.actual_other_cost,
        "estimated_total": estimated_total,
        "actual_total": actual_total,
        "remaining_budget": remaining_budget,
    }