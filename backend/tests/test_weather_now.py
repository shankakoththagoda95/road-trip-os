from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.integrations.weather import CurrentConditions, OpenMeteoWeatherProvider
from app.main import app
from app.services.weather import road_condition, visibility_rating


def conditions(**overrides) -> CurrentConditions:
    values = {
        "latitude": 52.42,
        "longitude": 10.78,
        "temperature_c": 12.0,
        "weather_code": 1,
        "wind_speed_kmh": 9.0,
        "visibility_m": 40_000.0,
        "temperature_max_c": 17.0,
        "temperature_min_c": 8.0,
        "precipitation_probability": 5.0,
    }
    values.update(overrides)
    return CurrentConditions(**values)


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({}, ("good", "Good")),
        ({"weather_code": 61}, ("caution", "Wet roads")),
        ({"weather_code": 45}, ("caution", "Fog")),
        ({"visibility_m": 600.0}, ("caution", "Fog")),
        ({"temperature_c": 1.0}, ("caution", "Possible ice")),
        ({"weather_code": 73}, ("poor", "Snow or ice")),
        ({"weather_code": 95}, ("poor", "Severe weather")),
        ({"visibility_m": 100.0}, ("poor", "Very low visibility")),
    ],
)
def test_road_condition(overrides, expected):
    assert road_condition(conditions(**overrides)) == expected


@pytest.mark.parametrize(
    ("metres", "expected"),
    [
        (None, None),
        (24_000, "excellent"),
        (10_000, "excellent"),
        (5_000, "good"),
        (1_500, "moderate"),
        (300, "poor"),
    ],
)
def test_visibility_rating(metres, expected):
    assert visibility_rating(metres) == expected


def test_provider_parses_open_meteo_response():
    response = MagicMock()
    response.json.return_value = {
        "current": {
            "temperature_2m": 16.7,
            "weather_code": 1,
            "wind_speed_10m": 9.0,
            "visibility": 40860.0,
        },
        "daily": {
            "temperature_2m_max": [17.3],
            "temperature_2m_min": [8.5],
            "precipitation_probability_max": [None],
        },
    }

    with patch("app.integrations.weather.httpx.get", return_value=response) as get:
        result = OpenMeteoWeatherProvider().get_current_conditions(52.42, 10.78)

    assert result.temperature_c == 16.7
    assert result.visibility_m == 40860.0
    assert result.temperature_max_c == 17.3
    # A missing probability counts as 0.
    assert result.precipitation_probability == 0
    assert "visibility" in get.call_args.kwargs["params"]["current"]


class FakeProvider:
    def get_current_conditions(self, latitude, longitude, hours=0):
        return conditions(latitude=latitude, longitude=longitude, weather_code=71)


def test_weather_now_endpoint(monkeypatch):
    monkeypatch.setattr("app.api.v1.weather.OpenMeteoWeatherProvider", FakeProvider)

    response = TestClient(app).get(
        "/weather/now", params={"latitude": 52.42, "longitude": 10.78}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["temperature_c"] == 12.0
    assert body["visibility"] == "excellent"
    assert body["road_conditions"] == {"level": "poor", "label": "Snow or ice"}


def test_weather_now_rejects_bad_coordinates():
    response = TestClient(app).get(
        "/weather/now", params={"latitude": 123, "longitude": 10}
    )

    assert response.status_code == 422
