from pydantic import BaseModel, Field


class EVChargingStationResponse(BaseModel):
    provider_id: str
    name: str
    latitude: float
    longitude: float
    country: str | None
    operator: str | None
    connector_types: list[str]
    charging_power_kw: float | None


class EVChargingStationsNearbyRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_km: float = Field(gt=0, le=100)