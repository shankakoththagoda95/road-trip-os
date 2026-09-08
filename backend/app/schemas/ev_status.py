from pydantic import BaseModel


class TripEVStatusResponse(BaseModel):
    trip_id: int
    battery_percentage: float
    available_range_km: float
    usable_range_km: float
    route_distance_km: float
    needs_charging: bool
    range_shortfall_km: float