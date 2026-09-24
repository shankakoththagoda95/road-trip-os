from datetime import date, datetime, timedelta
from unittest.mock import patch

import httpx
import pytest

from app.core.security import create_access_token
from app.integrations.elevation import ElevationPoint
from app.integrations.weather_forecast import DailyWeatherForecast
from app.services.route_conditions import (
    arrival_dates,
    build_route_conditions,
    condition_warnings,
    sample_route,
)


TODAY = date(2026, 9, 24)
DEPARTURE = datetime(2026, 9, 25, 9, 0)

# ~1,000 km along the equator.
LINE = [[index / 10, 0.0] for index in range(91)]

ROUTE = {
    "distance_meters": 1_000_000,
    "duration_seconds": 36_000,
    "points": [
        {"location": "A", "latitude": 0, "longitude": 0, "kind": "start"},
        {"location": "B", "latitude": 0, "longitude": 4.5, "kind": "stop"},
        {"location": "C", "latitude": 0, "longitude": 9, "kind": "destination"},
    ],
    "legs": [
        {"from_location": "A", "to_location": "B", "distance_meters": 500_000, "duration_seconds": 18_000},
        {"from_location": "B", "to_location": "C", "distance_meters": 500_000, "duration_seconds": 18_000},
    ],
    "geometry": {"type": "LineString", "coordinates": LINE},
}


def forecast(forecast_date, **overrides):
    values = {
        "forecast_date": forecast_date,
        "latitude": 0,
        "longitude": 0,
        "temperature_max_c": 15.0,
        "temperature_min_c": 8.0,
        "precipitation_probability": 10.0,
        "wind_speed_max_kmh": 12.0,
        "weather_code": 3,
    }

    return DailyWeatherForecast(**{**values, **overrides})


class FakeWeather:
    def __init__(self, **overrides):
        self.overrides = overrides
        self.calls = []

    def get_daily_forecast(self, latitude, longitude, forecast_date):
        self.calls.append(forecast_date)
        return forecast(forecast_date, **self.overrides)


class FakeElevation:
    def get_elevations(self, coordinates):
        # Climb 10 m per sample.
        return [
            ElevationPoint(latitude, longitude, index * 10.0)
            for index, (latitude, longitude) in enumerate(coordinates)
        ]


class FailingElevation:
    def get_elevations(self, coordinates):
        raise httpx.ConnectError("down")


def test_sample_route_returns_evenly_spaced_points():
    samples = sample_route([(lat, lon) for lon, lat in LINE], samples=11)

    assert len(samples) == 11
    assert samples[0][0] == 0
    assert samples[-1][0] == pytest.approx(1000.8, abs=1)
    assert samples[5][2] == pytest.approx(4.5, abs=0.1)


def test_arrival_dates_continuous_drive_crosses_midnight():
    dates = arrival_dates(
        datetime(2026, 9, 25, 20, 0),
        [3 * 3600, 3 * 3600],
        None,
    )

    assert dates == [date(2026, 9, 25), date(2026, 9, 25), date(2026, 9, 26)]


def test_arrival_dates_split_by_daily_limit():
    dates = arrival_dates(DEPARTURE, [5 * 3600, 5 * 3600, 5 * 3600], 8)

    assert dates == [
        date(2026, 9, 25),
        date(2026, 9, 25),
        date(2026, 9, 26),
        date(2026, 9, 26),
    ]


def test_arrival_on_exact_limit_is_same_day():
    dates = arrival_dates(DEPARTURE, [8 * 3600], 8)

    assert dates == [date(2026, 9, 25), date(2026, 9, 25)]


def weather_entry(**forecast_values):
    return {
        "location": "Oslo",
        "date": date(2026, 9, 25),
        "forecast": {
            "temperature_max_c": 10,
            "temperature_min_c": 5,
            "precipitation_probability": 0,
            "wind_speed_max_kmh": 10,
            "weather_code": 3,
            **forecast_values,
        },
    }


@pytest.mark.parametrize(
    ("values", "expected"),
    [
        ({"weather_code": 95}, "Thunderstorms"),
        ({"weather_code": 73}, "Snow"),
        ({"weather_code": 65}, "Heavy rain"),
        ({"weather_code": 45}, "Fog"),
        ({"temperature_min_c": -2}, "Freezing"),
        ({"wind_speed_max_kmh": 60}, "Strong wind (60 km/h)"),
    ],
)
def test_condition_warnings_for_weather(values, expected):
    warnings = condition_warnings([weather_entry(**values)], None)

    assert len(warnings) == 1
    assert expected in warnings[0]
    assert "Oslo (Fri 25 Sep)" in warnings[0]


def test_no_freezing_warning_when_snow_already_warned():
    warnings = condition_warnings(
        [weather_entry(weather_code=73, temperature_min_c=-5)],
        None,
    )

    assert warnings == ["Snow forecast at Oslo (Fri 25 Sep)"]


def test_condition_warnings_for_high_elevation():
    warnings = condition_warnings([], {"max_elevation_m": 2100})

    assert warnings == [
        "The route climbs to 2100 m: mountain roads may be closed "
        "or need winter equipment"
    ]


def test_build_route_conditions():
    weather = FakeWeather()

    result = build_route_conditions(
        ROUTE,
        DEPARTURE,
        max_driving_hours_per_day=5,
        weather_provider=weather,
        elevation_provider=FakeElevation(),
        today=TODAY,
    )

    assert [entry["location"] for entry in result["weather"]] == ["A", "B", "C"]
    assert [entry["date"] for entry in result["weather"]] == [
        date(2026, 9, 25),
        date(2026, 9, 25),
        date(2026, 9, 26),
    ]
    assert all(entry["forecast_available"] for entry in result["weather"])
    assert result["terrain"]["total_ascent_m"] == 900
    assert len(result["elevation_profile"]) == 91
    assert result["unavailable"] == []


def test_round_trip_adds_return_to_start():
    route = {
        **ROUTE,
        "points": [ROUTE["points"][0], ROUTE["points"][2]],
        "legs": ROUTE["legs"],
    }

    result = build_route_conditions(
        route,
        DEPARTURE,
        None,
        FakeWeather(),
        FakeElevation(),
        TODAY,
    )

    assert [entry["location"] for entry in result["weather"]] == ["A", "C", "A"]


def test_dates_beyond_forecast_range_have_no_forecast():
    weather = FakeWeather()

    result = build_route_conditions(
        ROUTE,
        datetime(2026, 12, 1, 9, 0),
        None,
        weather,
        FakeElevation(),
        TODAY,
    )

    assert weather.calls == []
    assert not any(entry["forecast_available"] for entry in result["weather"])
    assert result["unavailable"] == []


def test_elevation_failure_still_returns_weather():
    result = build_route_conditions(
        ROUTE,
        DEPARTURE,
        None,
        FakeWeather(),
        FailingElevation(),
        TODAY,
    )

    assert result["terrain"] is None
    assert result["elevation_profile"] == []
    assert result["unavailable"] == ["elevation"]
    assert all(entry["forecast"] for entry in result["weather"])


def test_conditions_endpoint(client, test_user):
    token = create_access_token(test_user.id)
    departure = datetime.now() + timedelta(days=1)

    with (
        patch("app.api.v1.routes.preview_route", return_value=ROUTE),
        patch(
            "app.api.v1.routes.OpenMeteoWeatherProvider",
            return_value=FakeWeather(weather_code=73),
        ),
        patch(
            "app.api.v1.routes.OpenMeteoElevationProvider",
            return_value=FakeElevation(),
        ),
    ):
        response = client.post(
            "/routes/conditions",
            json={
                "start": {"location": "A", "latitude": 0, "longitude": 0},
                "destination": {"location": "C", "latitude": 0, "longitude": 9},
                "departure_at": departure.strftime("%Y-%m-%dT%H:%M:%S"),
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200

    data = response.json()

    assert len(data["weather"]) == 3
    assert data["weather"][0]["forecast"]["weather_code"] == 73
    assert data["terrain"]["max_elevation_m"] == 900
    assert any("Snow" in warning for warning in data["warnings"])
