from datetime import date
from app.integrations.weather import (
    CurrentConditions,
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

# WMO weather codes grouped by how they affect driving.
SNOW_OR_ICE_CODES = {56, 57, 66, 67, 71, 73, 75, 77, 85, 86}
SEVERE_CODES = {82, 95, 96, 99}
FOG_CODES = {45, 48}
RAIN_CODES = {51, 53, 55, 61, 63, 65, 80, 81}


def visibility_rating(visibility_m: float | None) -> str | None:
    """
    Rough driving visibility: excellent from 10 km, good from 4 km,
    moderate from 1 km, poor below that.
    """
    if visibility_m is None:
        return None
    if visibility_m >= 10_000:
        return "excellent"
    if visibility_m >= 4_000:
        return "good"
    if visibility_m >= 1_000:
        return "moderate"
    return "poor"


def road_condition(conditions: CurrentConditions) -> tuple[str, str]:
    """
    A simple road rating from the current weather: (level, label), where
    level is "good", "caution" or "poor". Weather-based only; it knows
    nothing about closures or road works.
    """
    code = conditions.weather_code
    visibility = conditions.visibility_m

    if code in SNOW_OR_ICE_CODES:
        return "poor", "Snow or ice"
    if code in SEVERE_CODES:
        return "poor", "Severe weather"
    if visibility is not None and visibility < 200:
        return "poor", "Very low visibility"
    if conditions.temperature_c <= 2:
        return "caution", "Possible ice"
    if code in FOG_CODES or (visibility is not None and visibility < 1_000):
        return "caution", "Fog"
    if code in RAIN_CODES:
        return "caution", "Wet roads"
    return "good", "Good"


def get_current_conditions(
    provider,
    latitude: float,
    longitude: float,
    hours: int = 0,
) -> CurrentConditions:
    return provider.get_current_conditions(
        latitude=latitude,
        longitude=longitude,
        hours=hours,
    )
