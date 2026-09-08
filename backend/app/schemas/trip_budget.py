from pydantic import BaseModel, Field


class TripBudgetCreate(BaseModel):
    currency: str = Field(
        default="EUR",
        min_length=3,
        max_length=3,
    )

    estimated_fuel_cost: float = Field(default=0, ge=0)
    estimated_ev_charging_cost: float = Field(default=0, ge=0)
    estimated_toll_cost: float = Field(default=0, ge=0)
    estimated_food_cost: float = Field(default=0, ge=0)
    estimated_parking_cost: float = Field(default=0, ge=0)
    estimated_other_cost: float = Field(default=0, ge=0)

    actual_fuel_cost: float = Field(default=0, ge=0)
    actual_ev_charging_cost: float = Field(default=0, ge=0)
    actual_toll_cost: float = Field(default=0, ge=0)
    actual_food_cost: float = Field(default=0, ge=0)
    actual_parking_cost: float = Field(default=0, ge=0)
    actual_other_cost: float = Field(default=0, ge=0)


class TripBudgetUpdate(TripBudgetCreate):
    pass


class TripBudgetResponse(BaseModel):
    id: int
    trip_id: int
    currency: str

    estimated_fuel_cost: float
    estimated_ev_charging_cost: float
    estimated_toll_cost: float
    estimated_food_cost: float
    estimated_parking_cost: float
    estimated_other_cost: float

    actual_fuel_cost: float
    actual_ev_charging_cost: float
    actual_toll_cost: float
    actual_food_cost: float
    actual_parking_cost: float
    actual_other_cost: float

    estimated_total: float
    actual_total: float
    remaining_budget: float