from abc import ABC, abstractmethod
from dataclasses import dataclass
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