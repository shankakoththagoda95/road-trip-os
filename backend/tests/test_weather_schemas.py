import pytest
from pydantic import ValidationError
from datetime import date
from app.schemas.weather import (
    DailyWeatherRequest,
    DailyWeatherResponse,
    WeatherRequest,
    WeatherResponse,
)


def test_weather_request_accepts_valid_coordinates():
    request = WeatherRequest(
        latitude=59.3293,
        longitude=18.0686,
    )

    assert request.latitude == 59.3293
    assert request.longitude == 18.0686


@pytest.mark.parametrize(
    "latitude",
    [-91, 91],
)
def test_weather_request_rejects_invalid_latitude(latitude):
    with pytest.raises(ValidationError):
        WeatherRequest(
            latitude=latitude,
            longitude=18.0686,
        )


@pytest.mark.parametrize(
    "longitude",
    [-181, 181],
)
def test_weather_request_rejects_invalid_longitude(longitude):
    with pytest.raises(ValidationError):
        WeatherRequest(
            latitude=59.3293,
            longitude=longitude,
        )


def test_weather_response():
    response = WeatherResponse(
        latitude=59.3293,
        longitude=18.0686,
        temperature_c=17.9,
        precipitation_probability=26,
        wind_speed_kmh=15.8,
        weather_code=3,
    )

    assert response.temperature_c == 17.9
    assert response.precipitation_probability == 26
    assert response.wind_speed_kmh == 15.8
    assert response.weather_code == 3


def test_daily_weather_request_valid():
    request = DailyWeatherRequest(
        latitude=59.3293,
        longitude=18.0686,
        forecast_date=date(2026, 9, 10),
    )

    assert request.latitude == 59.3293
    assert request.longitude == 18.0686
    assert request.forecast_date == date(2026, 9, 10)


def test_daily_weather_response_valid():
    response = DailyWeatherResponse(
        forecast_date=date(2026, 9, 10),
        latitude=59.3293,
        longitude=18.0686,
        temperature_max_c=18.5,
        temperature_min_c=9.2,
        precipitation_probability=30,
        wind_speed_max_kmh=22.0,
        weather_code=3,
    )

    assert response.temperature_max_c == 18.5
    assert response.temperature_min_c == 9.2
    assert response.precipitation_probability == 30
    assert response.wind_speed_max_kmh == 22.0
    assert response.weather_code == 3