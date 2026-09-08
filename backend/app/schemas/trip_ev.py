from pydantic import BaseModel, Field


class TripEVCreate(BaseModel):
    starting_battery_percentage: float = Field(
        ge=0,
        le=100,
    )


class TripEVUpdate(BaseModel):
    starting_battery_percentage: float = Field(
        ge=0,
        le=100,
    )


class TripEVResponse(BaseModel):
    trip_id: int
    starting_battery_percentage: float
    current_battery_percentage: float