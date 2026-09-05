from pydantic import BaseModel, Field


class TripFuelEstimateResponse(BaseModel):
    trip_id: int
    distance_km: float
    fuel_required: float
    fuel_price_per_liter: float
    estimated_fuel_cost: float