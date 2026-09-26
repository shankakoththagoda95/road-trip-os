from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ChecklistCategory = Literal[
    "documents",
    "payments",
    "equipment",
    "winter",
    "rules",
    "vehicle",
]


def clean_name(name: str) -> str:
    name = name.strip()

    if not name:
        raise ValueError("Name can't be empty")

    return name


class TripChecklistItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=500)
    # Only for generated items.
    category: ChecklistCategory | None = None
    required: bool = False
    personal: bool = True
    checked: bool = False

    @field_validator("name")
    @classmethod
    def strip_name(cls, name: str) -> str:
        return clean_name(name)


class TripChecklistItemsCreate(BaseModel):
    items: list[TripChecklistItemCreate] = Field(max_length=200)


class TripChecklistItemUpdate(BaseModel):
    checked: bool | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("name")
    @classmethod
    def strip_name(cls, name: str | None) -> str | None:
        return None if name is None else clean_name(name)


class TripChecklistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trip_id: int
    name: str
    description: str | None
    category: ChecklistCategory | None
    required: bool
    personal: bool
    checked: bool
    position: int
