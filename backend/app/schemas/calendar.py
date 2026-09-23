from datetime import datetime

from pydantic import BaseModel


class CalendarEventResponse(BaseModel):
    title: str
    start_at: datetime
    end_at: datetime
    description: str


class CalendarResponse(BaseModel):
    trip_id: int
    events: list[CalendarEventResponse]