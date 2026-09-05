from pydantic import BaseModel


class VehicleFuelRangeResponse(BaseModel):
    vehicle_id: int
    fuel_available: float
    fuel_consumption: float
    estimated_range_km: float


class TripFuelStatusResponse(BaseModel):
    trip_id: int
    distance_traveled_km: float
    fuel_remaining: float
    remaining_range_km: float