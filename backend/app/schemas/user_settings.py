from pydantic import BaseModel, Field


class UserSettingsUpdate(BaseModel):
    gps_movement_threshold_meters: float = Field(
        default=20.0,
        ge=1.0,
        le=1000.0,
    )


class UserSettingsResponse(BaseModel):
    gps_movement_threshold_meters: float