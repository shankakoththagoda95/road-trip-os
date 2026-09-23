from pydantic import BaseModel


class BorderCrossingResponse(BaseModel):
    from_country: str
    to_country: str
    location: tuple[float, float] | None


class BorderCalculationResponse(BaseModel):
    trip_id: int
    crossings: list[BorderCrossingResponse]
    countries: list[str]