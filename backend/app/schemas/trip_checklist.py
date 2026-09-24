from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class TripChecklistRequest(BaseModel):
    # ISO 3166-1 alpha-2 codes in route order, e.g. ["SE", "NO"].
    country_codes: list[str] = Field(min_length=1)
    departure_date: date
    duration_days: int = Field(ge=1)
    vehicle_type: Literal["car", "motorcycle", "campervan", "van"] | None = None
    fuel_type: (
        Literal["petrol", "diesel", "hybrid", "plug_in_hybrid", "electric"]
        | None
    ) = None

    @field_validator("country_codes")
    @classmethod
    def validate_country_codes(cls, codes: list[str]) -> list[str]:
        for code in codes:
            if len(code) != 2 or not code.isalpha():
                raise ValueError(f"Invalid country code: {code}")

        return [code.upper() for code in codes]


class TripChecklistItemResponse(BaseModel):
    id: str
    category: Literal[
        "documents",
        "payments",
        "equipment",
        "winter",
        "rules",
        "vehicle",
    ]
    name: str
    description: str
    required: bool
    country_codes: list[str]


class TripChecklistResponse(BaseModel):
    items: list[TripChecklistItemResponse]
