from pydantic import BaseModel


class VehicleFuelRangeResponse(BaseModel):
    vehicle_id: int
    fuel_available: float
    fuel_consumption: float
    estimated_range_km: float