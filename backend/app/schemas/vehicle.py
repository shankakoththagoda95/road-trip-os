from enum import Enum

from pydantic import BaseModel, Field


class VehicleType(str, Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    CAMPERVAN = "campervan"
    VAN = "van"


class FuelType(str, Enum):
    PETROL = "petrol"
    DIESEL = "diesel"
    HYBRID = "hybrid"
    ELECTRIC = "electric"


class VehicleCreate(BaseModel):
    name: str
    vehicle_type: VehicleType
    fuel_type: FuelType
    fuel_consumption: float | None = Field(
        default=None,
        gt=0,
    )
    tank_capacity: float | None = Field(
        default=None,
        gt=0,
    )
    battery_capacity: float | None = Field(
        default=None,
        gt=0,
    )
    energy_consumption: float | None = Field(
        default=None,
        gt=0,
    )


class VehicleUpdate(BaseModel):
    name: str
    vehicle_type: VehicleType
    fuel_type: FuelType
    fuel_consumption: float | None = Field(
        default=None,
        gt=0,
    )
    tank_capacity: float | None = Field(
        default=None,
        gt=0,
    )
    battery_capacity: float | None = Field(
        default=None,
        gt=0,
    )
    energy_consumption: float | None = Field(
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
    battery_capacity: float | None
    energy_consumption: float | None