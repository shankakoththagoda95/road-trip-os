from pydantic import BaseModel, Field


class TripFuelCreate(BaseModel):
    starting_fuel: float = Field(ge=0)
    current_fuel: float = Field(ge=0)
    fuel_used: float = Field(ge=0)
    fuel_cost: float = Field(ge=0)


class TripFuelUpdate(BaseModel):
    starting_fuel: float = Field(ge=0)
    current_fuel: float = Field(ge=0)
    fuel_used: float = Field(ge=0)
    fuel_cost: float = Field(ge=0)


class TripFuelResponse(BaseModel):
    id: int
    trip_id: int
    starting_fuel: float
    current_fuel: float
    fuel_used: float
    fuel_cost: float