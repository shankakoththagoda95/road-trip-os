from fastapi.testclient import TestClient

from app.api.v1.weather import router
from app.integrations.weather import WeatherForecast
from app.main import app


class FakeWeatherProvider:
    def get_forecast(
        self,
        latitude: float,
        longitude: float,
    ) -> WeatherForecast:
        return WeatherForecast(
            latitude=latitude,
            longitude=longitude,
            temperature_c=21.5,
            precipitation_probability=15,
            wind_speed_kmh=10.0,
            weather_code=1,
        )


def test_get_current_weather(monkeypatch):
    def mock_provider():
        return FakeWeatherProvider()

    monkeypatch.setattr(
        "app.api.v1.weather.OpenMeteoWeatherProvider",
        mock_provider,
    )

    client = TestClient(app)

    response = client.post(
        "/weather/current",
        json={
            "latitude": 59.3293,
            "longitude": 18.0686,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["latitude"] == 59.3293
    assert data["longitude"] == 18.0686
    assert data["temperature_c"] == 21.5
    assert data["precipitation_probability"] == 15
    assert data["wind_speed_kmh"] == 10.0
    assert data["weather_code"] == 1


def test_daily_weather_api(client, monkeypatch):
    class FakeWeatherProvider:
        def get_daily_forecast(
            self,
            latitude,
            longitude,
            forecast_date,
        ):
            from datetime import date

            from app.integrations.weather_forecast import (
                DailyWeatherForecast,
            )

            return DailyWeatherForecast(
                forecast_date=date(2026, 9, 10),
                latitude=59.3293,
                longitude=18.0686,
                temperature_max_c=18.5,
                temperature_min_c=9.2,
                precipitation_probability=30,
                wind_speed_max_kmh=22.0,
                weather_code=3,
            )

    monkeypatch.setattr(
        "app.api.v1.weather.OpenMeteoWeatherProvider",
        lambda: FakeWeatherProvider(),
    )

    response = client.post(
        "/weather/daily",
        json={
            "latitude": 59.3293,
            "longitude": 18.0686,
            "forecast_date": "2026-09-10",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["forecast_date"] == "2026-09-10"
    assert data["latitude"] == 59.3293
    assert data["longitude"] == 18.0686
    assert data["temperature_max_c"] == 18.5
    assert data["temperature_min_c"] == 9.2
    assert data["precipitation_probability"] == 30
    assert data["wind_speed_max_kmh"] == 22.0
    assert data["weather_code"] == 3