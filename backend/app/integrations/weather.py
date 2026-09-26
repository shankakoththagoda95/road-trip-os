from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import httpx
from datetime import date
from app.integrations.weather_forecast import DailyWeatherForecast


@dataclass
class WeatherForecast:
    latitude: float
    longitude: float
    temperature_c: float
    precipitation_probability: float
    wind_speed_kmh: float
    weather_code: int


@dataclass
class HourlyForecast:
    # Local time at the place, e.g. "2026-09-25T19:00".
    time: str
    temperature_c: float
    weather_code: int
    precipitation_probability: float


@dataclass
class CurrentConditions:
    latitude: float
    longitude: float
    temperature_c: float
    weather_code: int
    wind_speed_kmh: float
    # Metres; None when the model has no value.
    visibility_m: float | None
    # Today, in the place's own time zone.
    temperature_max_c: float
    temperature_min_c: float
    precipitation_probability: float
    # From the current hour on; empty unless requested.
    next_hours: list[HourlyForecast] = field(default_factory=list)


class WeatherProvider(ABC):
    @abstractmethod
    def get_forecast(
        self,
        latitude: float,
        longitude: float,
    ) -> WeatherForecast:
        pass


class OpenMeteoWeatherProvider(WeatherProvider):
    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    def get_forecast(
        self,
        latitude: float,
        longitude: float,
    ) -> WeatherForecast:
        response = httpx.get(
            self.BASE_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "current": (
                    "temperature_2m,"
                    "precipitation_probability,"
                    "wind_speed_10m,"
                    "weather_code"
                ),
            }
        )

        response.raise_for_status()

        data = response.json()
        current = data["current"]

        return WeatherForecast(
            latitude=latitude,
            longitude=longitude,
            temperature_c=current["temperature_2m"],
            precipitation_probability=current["precipitation_probability"],
            wind_speed_kmh=current["wind_speed_10m"],
            weather_code=current["weather_code"],
        )


    def get_current_conditions(
        self,
        latitude: float,
        longitude: float,
        hours: int = 0,
    ) -> CurrentConditions:
        hourly_params = (
            {
                "hourly": (
                    "temperature_2m,"
                    "weather_code,"
                    "precipitation_probability"
                ),
                # Starts at the current hour.
                "forecast_hours": hours,
            }
            if hours > 0
            else {}
        )

        response = httpx.get(
            self.BASE_URL,
            params={
                **hourly_params,
                "latitude": latitude,
                "longitude": longitude,
                "current": (
                    "temperature_2m,"
                    "weather_code,"
                    "wind_speed_10m,"
                    "visibility"
                ),
                "daily": (
                    "temperature_2m_max,"
                    "temperature_2m_min,"
                    "precipitation_probability_max"
                ),
                "forecast_days": 1,
                "timezone": "auto",
            },
        )

        response.raise_for_status()

        data = response.json()
        current = data["current"]
        daily = data["daily"]

        return CurrentConditions(
            latitude=latitude,
            longitude=longitude,
            temperature_c=current["temperature_2m"],
            weather_code=current["weather_code"],
            wind_speed_kmh=current["wind_speed_10m"],
            visibility_m=current.get("visibility"),
            temperature_max_c=daily["temperature_2m_max"][0],
            temperature_min_c=daily["temperature_2m_min"][0],
            precipitation_probability=(
                daily["precipitation_probability_max"][0] or 0
            ),
            next_hours=_hourly(data.get("hourly")),
        )

    def get_daily_forecast(
        self,
        latitude: float,
        longitude: float,
        forecast_date: date,
    ) -> DailyWeatherForecast:
        response = httpx.get(
            self.BASE_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "daily": (
                    "temperature_2m_max,"
                    "temperature_2m_min,"
                    "precipitation_probability_max,"
                    "wind_speed_10m_max,"
                    "weather_code"
                ),
                "start_date": forecast_date.isoformat(),
                "end_date": forecast_date.isoformat(),
                "timezone": "auto",
            },
        )
    
        response.raise_for_status()
    
        data = response.json()
        daily = data["daily"]
    
        return DailyWeatherForecast(
            forecast_date=forecast_date,
            latitude=latitude,
            longitude=longitude,
            temperature_max_c=daily["temperature_2m_max"][0],
            temperature_min_c=daily["temperature_2m_min"][0],
            precipitation_probability=daily[
                "precipitation_probability_max"
            ][0],
            wind_speed_max_kmh=daily["wind_speed_10m_max"][0],
            weather_code=daily["weather_code"][0],
        )

def _hourly(hourly: dict | None) -> list[HourlyForecast]:
    if not hourly:
        return []

    return [
        HourlyForecast(
            time=time,
            temperature_c=temperature,
            weather_code=code,
            precipitation_probability=probability or 0,
        )
        for time, temperature, code, probability in zip(
            hourly["time"],
            hourly["temperature_2m"],
            hourly["weather_code"],
            hourly["precipitation_probability"],
        )
    ]
