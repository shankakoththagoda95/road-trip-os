from enum import Enum

from pydantic import BaseModel, Field, field_validator


class VehicleType(str, Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    CAMPERVAN = "campervan"
    VAN = "van"


class FuelType(str, Enum):
    PETROL = "petrol"
    DIESEL = "diesel"
    HYBRID = "hybrid"
    PLUG_IN_HYBRID = "plug_in_hybrid"
    ELECTRIC = "electric"


class VehicleCreate(BaseModel):
    name: str = Field(
        min_length=1,
        pattern=r".*\S.*",
    )
    brand: str | None = Field(default=None, max_length=60)
    model: str | None = Field(default=None, max_length=60)
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

    @field_validator("brand", "model")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()

        return value or None


class VehicleUpdate(BaseModel):
    name: str = Field(
        min_length=1,
        pattern=r".*\S.*",
    )
    brand: str | None = Field(default=None, max_length=60)
    model: str | None = Field(default=None, max_length=60)
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

    @field_validator("brand", "model")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()

        return value or None


class VehicleResponse(BaseModel):
    id: int
    user_id: int
    name: str
    brand: str | None = None
    model: str | None = None
    vehicle_type: str
    fuel_type: str
    fuel_consumption: float | None
    tank_capacity: float | None
    battery_capacity: float | None
    energy_consumption: float | None