from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

DayMeal = Literal["breakfast", "lunch", "dinner"]
MealName = Literal["breakfast", "lunch", "dinner", "snacks"]
MealKind = Literal["fast_food", "home_prep"]


class TripMealUpdate(BaseModel):
    # Day of the trip for breakfast / lunch / dinner; omitted for snacks.
    day_number: int | None = Field(default=None, ge=1)
    meal: MealName
    kind: MealKind
    description: str | None = Field(default=None, max_length=500)

    @field_validator("description")
    @classmethod
    def strip_description(cls, description: str | None) -> str | None:
        if description is None:
            return None
        return description.strip() or None

    @model_validator(mode="after")
    def check_slot(self):
        if self.meal == "snacks" and self.day_number is not None:
            raise ValueError("Snacks are planned for the whole trip, not a day")
        if self.meal != "snacks" and self.day_number is None:
            raise ValueError("Breakfast, lunch and dinner need a day_number")
        # Fast food has nothing to prepare.
        if self.kind == "fast_food":
            self.description = None
        return self


class TripMealResponse(BaseModel):
    day_number: int | None
    meal: MealName
    kind: MealKind
    description: str | None


class TripMealDay(BaseModel):
    day_number: int
    breakfast: TripMealResponse
    lunch: TripMealResponse
    dinner: TripMealResponse


class TripMealPlanResponse(BaseModel):
    # One entry per day of the trip, in order.
    days: list[TripMealDay]
    # For the whole trip.
    snacks: TripMealResponse
