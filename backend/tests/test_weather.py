import httpx
import pytest
from datetime import date

from app.integrations.weather import (
    OpenMeteoWeatherProvider,
)
from app.integrations.weather_forecast import (
    DailyWeatherForecast,
)


def test_open_meteo_get_forecast(monkeypatch):
    provider = OpenMeteoWeatherProvider()

    mock_response = httpx.Response(
        200,
        json={
            "current": {
                "temperature_2m": 18.5,
                "precipitation_probability": 20,
                "wind_speed_10m": 12.3,
                "weather_code": 1,
            }
        },
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/forecast",
        ),
    )

    def mock_get(*args, **kwargs):
        return mock_response

    monkeypatch.setattr(httpx, "get", mock_get)

    result = provider.get_forecast(
        latitude=59.3293,
        longitude=18.0686,
    )

    assert result.latitude == 59.3293
    assert result.longitude == 18.0686
    assert result.temperature_c == 18.5
    assert result.precipitation_probability == 20
    assert result.wind_speed_kmh == 12.3
    assert result.weather_code == 1


def test_open_meteo_get_forecast_http_error(monkeypatch):
    provider = OpenMeteoWeatherProvider()

    mock_response = httpx.Response(
        500,
        json={"error": "server error"},
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/forecast",
        ),
    )

    def mock_get(*args, **kwargs):
        return mock_response

    monkeypatch.setattr(httpx, "get", mock_get)

    with pytest.raises(httpx.HTTPStatusError):
        provider.get_forecast(
            latitude=59.3293,
            longitude=18.0686,
        )


def test_open_meteo_get_forecast_uses_coordinates(monkeypatch):
    provider = OpenMeteoWeatherProvider()

    mock_response = httpx.Response(
        200,
        json={
            "current": {
                "temperature_2m": 18.5,
                "precipitation_probability": 20,
                "wind_speed_10m": 12.3,
                "weather_code": 1,
            }
        },
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/forecast",
        ),
    )

    captured = {}

    def mock_get(*args, **kwargs):
        captured["url"] = args[0]
        captured["params"] = kwargs["params"]
        return mock_response

    monkeypatch.setattr(httpx, "get", mock_get)

    provider.get_forecast(
        latitude=59.3293,
        longitude=18.0686,
    )

    assert captured["url"] == (
        "https://api.open-meteo.com/v1/forecast"
    )
    assert captured["params"]["latitude"] == 59.3293
    assert captured["params"]["longitude"] == 18.0686


def test_open_meteo_get_daily_forecast(monkeypatch):
    provider = OpenMeteoWeatherProvider()

    mock_response = httpx.Response(
        200,
        json={
            "daily": {
                "temperature_2m_max": [22.5],
                "temperature_2m_min": [12.0],
                "precipitation_probability_max": [30],
                "wind_speed_10m_max": [18.5],
                "weather_code": [2],
            }
        },
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/forecast",
        ),
    )

    def mock_get(*args, **kwargs):
        return mock_response

    monkeypatch.setattr(httpx, "get", mock_get)

    result = provider.get_daily_forecast(
        latitude=59.3293,
        longitude=18.0686,
        forecast_date=date(2026, 9, 10),
    )

    assert isinstance(result, DailyWeatherForecast)
    assert result.forecast_date == date(2026, 9, 10)
    assert result.latitude == 59.3293
    assert result.longitude == 18.0686
    assert result.temperature_max_c == 22.5
    assert result.temperature_min_c == 12.0
    assert result.precipitation_probability == 30
    assert result.wind_speed_max_kmh == 18.5
    assert result.weather_code == 2


def test_open_meteo_get_daily_forecast_uses_date_and_parameters(
    monkeypatch,
):
    provider = OpenMeteoWeatherProvider()

    mock_response = httpx.Response(
        200,
        json={
            "daily": {
                "temperature_2m_max": [22.5],
                "temperature_2m_min": [12.0],
                "precipitation_probability_max": [30],
                "wind_speed_10m_max": [18.5],
                "weather_code": [2],
            }
        },
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/forecast",
        ),
    )

    captured = {}

    def mock_get(*args, **kwargs):
        captured["url"] = args[0]
        captured["params"] = kwargs["params"]
        return mock_response

    monkeypatch.setattr(httpx, "get", mock_get)

    provider.get_daily_forecast(
        latitude=59.3293,
        longitude=18.0686,
        forecast_date=date(2026, 9, 10),
    )

    assert captured["url"] == (
        "https://api.open-meteo.com/v1/forecast"
    )

    assert captured["params"]["latitude"] == 59.3293
    assert captured["params"]["longitude"] == 18.0686
    assert captured["params"]["start_date"] == "2026-09-10"
    assert captured["params"]["end_date"] == "2026-09-10"
    assert captured["params"]["timezone"] == "auto"

    assert (
        captured["params"]["daily"]
        == (
            "temperature_2m_max,"
            "temperature_2m_min,"
            "precipitation_probability_max,"
            "wind_speed_10m_max,"
            "weather_code"
        )
    )