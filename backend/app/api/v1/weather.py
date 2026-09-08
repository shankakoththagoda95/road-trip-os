from fastapi import APIRouter

from app.integrations.weather import OpenMeteoWeatherProvider
from app.schemas.weather import (
    DailyWeatherRequest,
    DailyWeatherResponse,
    WeatherRequest,
    WeatherResponse,
)
from app.services.weather import (
    get_current_weather,
    get_daily_weather,
)


router = APIRouter(
    prefix="/weather",
    tags=["weather"],
)


@router.post(
    "/current",
    response_model=WeatherResponse,
)
def get_weather(request: WeatherRequest):
    provider = OpenMeteoWeatherProvider()

    weather = get_current_weather(
        provider=provider,
        latitude=request.latitude,
        longitude=request.longitude,
    )

    return WeatherResponse(
        latitude=weather.latitude,
        longitude=weather.longitude,
        temperature_c=weather.temperature_c,
        precipitation_probability=weather.precipitation_probability,
        wind_speed_kmh=weather.wind_speed_kmh,
        weather_code=weather.weather_code,
    )


@router.post(
    "/daily",
    response_model=DailyWeatherResponse,
)
def get_daily_weather_forecast(
    request: DailyWeatherRequest,
):
    provider = OpenMeteoWeatherProvider()

    weather = get_daily_weather(
        provider=provider,
        latitude=request.latitude,
        longitude=request.longitude,
        forecast_date=request.forecast_date,
    )

    return {
        "forecast_date": weather.forecast_date,
        "latitude": weather.latitude,
        "longitude": weather.longitude,
        "temperature_max_c": weather.temperature_max_c,
        "temperature_min_c": weather.temperature_min_c,
        "precipitation_probability": weather.precipitation_probability,
        "wind_speed_max_kmh": weather.wind_speed_max_kmh,
        "weather_code": weather.weather_code,
    }