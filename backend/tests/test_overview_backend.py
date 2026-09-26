from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.integrations.weather import OpenMeteoWeatherProvider
from app.main import app
from app.services import geocoding
from app.services.geocoding import reverse_place


def response(json_data):
    mock = MagicMock()
    mock.json.return_value = json_data
    mock.raise_for_status.return_value = None
    return mock


OPEN_METEO = {
    "current": {
        "temperature_2m": 16.7,
        "weather_code": 1,
        "wind_speed_10m": 9.0,
        "visibility": 40000.0,
    },
    "daily": {
        "temperature_2m_max": [17.3],
        "temperature_2m_min": [8.5],
        "precipitation_probability_max": [5],
    },
}


def test_next_hours_are_parsed_when_asked_for():
    data = {
        **OPEN_METEO,
        "hourly": {
            "time": ["2026-09-25T19:00", "2026-09-25T20:00"],
            "temperature_2m": [16.2, 14.1],
            "weather_code": [0, 61],
            "precipitation_probability": [0, None],
        },
    }

    with patch("app.integrations.weather.httpx.get", return_value=response(data)) as get:
        result = OpenMeteoWeatherProvider().get_current_conditions(52.4, 10.8, hours=2)

    params = get.call_args.kwargs["params"]
    assert params["forecast_hours"] == 2
    assert "weather_code" in params["hourly"]
    assert [(hour.time, hour.weather_code) for hour in result.next_hours] == [
        ("2026-09-25T19:00", 0),
        ("2026-09-25T20:00", 61),
    ]
    # A missing probability counts as 0.
    assert result.next_hours[1].precipitation_probability == 0


def test_no_hourly_request_by_default():
    with patch("app.integrations.weather.httpx.get", return_value=response(OPEN_METEO)) as get:
        result = OpenMeteoWeatherProvider().get_current_conditions(52.4, 10.8)

    assert "hourly" not in get.call_args.kwargs["params"]
    assert result.next_hours == []


def test_weather_now_endpoint_returns_next_hours():
    data = {
        **OPEN_METEO,
        "hourly": {
            "time": ["2026-09-25T19:00"],
            "temperature_2m": [16.2],
            "weather_code": [0],
            "precipitation_probability": [10],
        },
    }

    with patch("app.integrations.weather.httpx.get", return_value=response(data)):
        body = TestClient(app).get(
            "/weather/now", params={"latitude": 52.4, "longitude": 10.8, "hours": 1}
        ).json()

    assert body["next_hours"] == [
        {
            "time": "2026-09-25T19:00",
            "temperature_c": 16.2,
            "weather_code": 0,
            "precipitation_probability": 10,
        }
    ]


@pytest.fixture(autouse=True)
def fresh_place_cache():
    geocoding.clear_place_cache()
    yield
    geocoding.clear_place_cache()


NOMINATIM_WOLFSBURG = {
    "address": {
        "town": "Wolfsburg",
        "state": "Lower Saxony",
        "country": "Germany",
        "country_code": "de",
    }
}


def test_reverse_place_prefers_the_town_and_caches_nearby_points():
    with patch(
        "app.services.geocoding.httpx.get", return_value=response(NOMINATIM_WOLFSBURG)
    ) as get:
        first = reverse_place(52.4227, 10.7865)
        # A few hundred metres away: same cache entry.
        second = reverse_place(52.4201, 10.7899)

    assert first == {
        "name": "Wolfsburg",
        "region": "Lower Saxony",
        "country": "Germany",
        "country_code": "DE",
    }
    assert second == first
    assert get.call_count == 1
    assert get.call_args.kwargs["params"]["zoom"] == 10


def test_reverse_place_at_sea_is_none():
    with patch("app.services.geocoding.httpx.get", return_value=response({"error": "Unable to geocode"})):
        assert reverse_place(55.0, 3.0) is None


def test_reverse_endpoint(client, test_user):
    headers = {"Authorization": f"Bearer {create_access_token(test_user.id)}"}

    with patch(
        "app.services.geocoding.httpx.get", return_value=response(NOMINATIM_WOLFSBURG)
    ):
        found = client.get(
            "/places/reverse", params={"latitude": 52.42, "longitude": 10.78}, headers=headers
        )

    assert found.status_code == 200
    assert found.json()["name"] == "Wolfsburg"

    with patch("app.services.geocoding.httpx.get", return_value=response({})):
        missing = client.get(
            "/places/reverse", params={"latitude": 55.0, "longitude": 3.0}, headers=headers
        )

    assert missing.status_code == 404


def test_reverse_endpoint_needs_login(client):
    response_ = client.get("/places/reverse", params={"latitude": 52.42, "longitude": 10.78})

    assert response_.status_code == 401
