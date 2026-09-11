from pydantic import BaseModel


class TollFeeResponse(BaseModel):
    name: str
    country: str
    amount: float
    currency: str


class TollCalculationResponse(BaseModel):
    trip_id: int
    fees: list[TollFeeResponse]
    total_amount: float
    currency: str