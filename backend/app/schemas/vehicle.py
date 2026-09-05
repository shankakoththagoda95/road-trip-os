from pydantic import BaseModel, Field


class VehicleCreate(BaseModel):
    name: str
    vehicle_type: str
    fuel_type: str
    fuel_consumption: float | None = Field(
        default=None,
        gt=0,
    )
    tank_capacity: float | None = Field(
        default=None,
        gt=0,
    )


class VehicleUpdate(BaseModel):
    name: str
    vehicle_type: str
    fuel_type: str
    fuel_consumption: float | None = Field(
        default=None,
        gt=0,
    )
    tank_capacity: float | None = Field(
        default=None,
        gt=0,
    )


class VehicleResponse(BaseModel):
    id: int
    user_id: int
    name: str
    vehicle_type: str
    fuel_type: str
    fuel_consumption: float | None
    tank_capacity: float | None