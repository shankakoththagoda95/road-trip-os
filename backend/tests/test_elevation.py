import httpx
import pytest

from app.integrations.elevation import (
    OpenMeteoElevationProvider,
)


def test_get_elevation():
    provider = OpenMeteoElevationProvider()

    response = httpx.Response(
        200,
        json={
            "elevation": [24.0],
        },
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/elevation",
        ),
    )

    original_get = httpx.get

    try:
        httpx.get = lambda *args, **kwargs: response

        result = provider.get_elevation(
            latitude=59.3293,
            longitude=18.0686,
        )

        assert result.latitude == 59.3293
        assert result.longitude == 18.0686
        assert result.elevation_m == 24.0

    finally:
        httpx.get = original_get


def test_get_elevation_http_error():
    provider = OpenMeteoElevationProvider()

    response = httpx.Response(
        500,
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/elevation",
        ),
    )

    original_get = httpx.get

    try:
        httpx.get = lambda *args, **kwargs: response

        with pytest.raises(httpx.HTTPStatusError):
            provider.get_elevation(
                latitude=59.3293,
                longitude=18.0686,
            )

    finally:
        httpx.get = original_get


def test_get_elevations():
    provider = OpenMeteoElevationProvider()

    response = httpx.Response(
        200,
        json={
            "elevation": [24.0, 40.0, 15.0],
        },
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/elevation",
        ),
    )

    original_get = httpx.get

    try:
        httpx.get = lambda *args, **kwargs: response

        coordinates = [
            (59.3293, 18.0686),
            (59.1950, 17.6253),
            (58.7530, 17.0079),
        ]

        result = provider.get_elevations(coordinates)

        assert len(result) == 3

        assert result[0].latitude == 59.3293
        assert result[0].longitude == 18.0686
        assert result[0].elevation_m == 24.0

        assert result[1].latitude == 59.1950
        assert result[1].longitude == 17.6253
        assert result[1].elevation_m == 40.0

        assert result[2].latitude == 58.7530
        assert result[2].longitude == 17.0079
        assert result[2].elevation_m == 15.0

    finally:
        httpx.get = original_get


def test_get_elevations_empty_coordinates():
    provider = OpenMeteoElevationProvider()

    result = provider.get_elevations([])

    assert result == []


def test_get_elevations_uses_coordinates():
    provider = OpenMeteoElevationProvider()

    response = httpx.Response(
        200,
        json={
            "elevation": [24.0, 40.0],
        },
        request=httpx.Request(
            "GET",
            "https://api.open-meteo.com/v1/elevation",
        ),
    )

    original_get = httpx.get

    captured = {}

    def fake_get(*args, **kwargs):
        captured["url"] = args[0]
        captured["params"] = kwargs["params"]
        return response

    try:
        httpx.get = fake_get

        coordinates = [
            (59.3293, 18.0686),
            (59.1950, 17.6253),
        ]

        provider.get_elevations(coordinates)

        assert captured["url"] == provider.BASE_URL
        assert captured["params"]["latitude"] == "59.3293,59.195"
        assert captured["params"]["longitude"] == "18.0686,17.6253"

    finally:
        httpx.get = original_get