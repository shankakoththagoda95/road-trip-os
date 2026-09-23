from pydantic import BaseModel


class TravelChecklistItemResponse(BaseModel):
    name: str
    required: bool
    description: str


class TravelChecklistResponse(BaseModel):
    trip_id: int
    items: list[TravelChecklistItemResponse]