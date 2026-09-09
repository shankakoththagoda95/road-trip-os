from pydantic import BaseModel, Field
from pydantic import BaseModel, Field, field_validator

class ElevationRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ElevationResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_m: float


class ElevationProfileRequest(BaseModel):
    coordinates: list[tuple[float, float]] = Field(min_length=1)

    @field_validator("coordinates")
    @classmethod
    def validate_coordinates(
        cls,
        coordinates: list[tuple[float, float]],
    ) -> list[tuple[float, float]]:
        for latitude, longitude in coordinates:
            if not -90 <= latitude <= 90:
                raise ValueError(
                    "Latitude must be between -90 and 90"
                )

            if not -180 <= longitude <= 180:
                raise ValueError(
                    "Longitude must be between -180 and 180"
                )

        return coordinates


class ElevationProfileResponse(BaseModel):
    points: list[ElevationResponse]


class TerrainSummaryResponse(BaseModel):
    total_ascent_m: float
    total_descent_m: float
    max_elevation_m: float
    min_elevation_m: float
    elevation_range_m: float