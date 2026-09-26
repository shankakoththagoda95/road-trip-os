from datetime import date

from pydantic import BaseModel, Field


class WeatherResponse(BaseModel):
    latitude: float
    longitude: float
    temperature_c: float
    precipitation_probability: float
    wind_speed_kmh: float
    weather_code: int


class RoadConditionResponse(BaseModel):
    # "good", "caution" or "poor".
    level: str
    label: str


class HourlyForecastResponse(BaseModel):
    # Local time at the place, e.g. "2026-09-25T19:00".
    time: str
    temperature_c: float
    weather_code: int
    precipitation_probability: float


class CurrentConditionsResponse(BaseModel):
    latitude: float
    longitude: float
    temperature_c: float
    weather_code: int
    wind_speed_kmh: float
    visibility_m: float | None
    # "excellent", "good", "moderate", "poor", or None without data.
    visibility: str | None
    temperature_max_c: float
    temperature_min_c: float
    precipitation_probability: float
    road_conditions: RoadConditionResponse
    # The next hours, from the current one (when `hours` is asked for).
    next_hours: list[HourlyForecastResponse] = []


class WeatherRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class DailyWeatherRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    forecast_date: date


class DailyWeatherResponse(BaseModel):
    forecast_date: date
    latitude: float
    longitude: float
    temperature_max_c: float
    temperature_min_c: float
    precipitation_probability: float
    wind_speed_max_kmh: float
    weather_code: int