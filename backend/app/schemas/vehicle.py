from pydantic import BaseModel


class VehicleCreate(BaseModel):
    name: str
    vehicle_type: str
    fuel_type: str
    fuel_consumption: float | None = None
    tank_capacity: float | None = None


class VehicleUpdate(BaseModel):
    name: str
    vehicle_type: str
    fuel_type: str
    fuel_consumption: float | None = None
    tank_capacity: float | None = None


class VehicleResponse(BaseModel):
    id: int
    user_id: int
    name: str
    vehicle_type: str
    fuel_type: str
    fuel_consumption: float | None
    tank_capacity: float | None