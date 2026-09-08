from datetime import date
from app.integrations.weather import (
    WeatherForecast,
    WeatherProvider,
)
from app.integrations.weather_forecast import DailyWeatherForecast


def get_current_weather(
    provider: WeatherProvider,
    latitude: float,
    longitude: float,
) -> WeatherForecast:
    return provider.get_forecast(
        latitude=latitude,
        longitude=longitude,
    )


def get_daily_weather(
    provider: WeatherProvider,
    latitude: float,
    longitude: float,
    forecast_date: date,
) -> DailyWeatherForecast:
    return provider.get_daily_forecast(
        latitude=latitude,
        longitude=longitude,
        forecast_date=forecast_date,
    )