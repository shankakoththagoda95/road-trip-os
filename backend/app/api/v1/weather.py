from dataclasses import asdict

from fastapi import APIRouter, Query

from app.integrations.weather import OpenMeteoWeatherProvider
from app.schemas.weather import (
    DailyWeatherRequest,
    CurrentConditionsResponse,
    DailyWeatherResponse,
    WeatherRequest,
    WeatherResponse,
)
from app.services.weather import (
    get_current_conditions,
    get_current_weather,
    get_daily_weather,
    road_condition,
    visibility_rating,
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


@router.get(
    "/now",
    response_model=CurrentConditionsResponse,
)
def get_weather_now(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    # Also return the forecast for the next hours (0 = none).
    hours: int = Query(default=0, ge=0, le=24),
):
    """
    Weather right now at a place, with today's range, visibility and a
    simple road-conditions rating.
    """
    provider = OpenMeteoWeatherProvider()

    conditions = get_current_conditions(
        provider=provider,
        latitude=latitude,
        longitude=longitude,
        hours=hours,
    )
    level, label = road_condition(conditions)

    return CurrentConditionsResponse(
        latitude=conditions.latitude,
        longitude=conditions.longitude,
        temperature_c=conditions.temperature_c,
        weather_code=conditions.weather_code,
        wind_speed_kmh=conditions.wind_speed_kmh,
        visibility_m=conditions.visibility_m,
        visibility=visibility_rating(conditions.visibility_m),
        temperature_max_c=conditions.temperature_max_c,
        temperature_min_c=conditions.temperature_min_c,
        precipitation_probability=conditions.precipitation_probability,
        road_conditions={"level": level, "label": label},
        next_hours=[asdict(hour) for hour in conditions.next_hours],
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