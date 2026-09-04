from datetime import datetime

from pydantic import BaseModel

from app.schemas.route import DistanceStatus, DrivingTimeStatus


class ItineraryDayResponse(BaseModel):
    id: int
    itinerary_id: int
    day_number: int
    total_distance_meters: float
    total_duration_seconds: float
    distance_status: DistanceStatus
    driving_time_status: DrivingTimeStatus


class ItineraryResponse(BaseModel):
    id: int
    trip_id: int
    created_at: datetime
    updated_at: datetime
    days: list[ItineraryDayResponse]