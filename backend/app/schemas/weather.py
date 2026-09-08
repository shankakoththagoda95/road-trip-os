from datetime import date

from pydantic import BaseModel, Field


class WeatherResponse(BaseModel):
    latitude: float
    longitude: float
    temperature_c: float
    precipitation_probability: float
    wind_speed_kmh: float
    weather_code: int


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