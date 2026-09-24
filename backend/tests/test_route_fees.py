import json
from unittest.mock import patch

import httpx
import pytest

from app.core.security import create_access_token
from app.integrations.countries import Country, CountryLocator, get_country_locator
from app.services.road_fees import calculate_road_fees, fixed_tolls_on_route
from app.services.route_countries import (
    CountryStretch,
    NaturalEarthBorderProvider,
    country_stretches,
)


ALPHA = Country("AA", "Alpha")
BETA = Country("BB", "Beta")

# ~1,000 km east along the equator, a point every ~1.1 km.
ROUTE = [(0.0, index / 100) for index in range(901)]


def square(west, east, south=-1.0, north=1.0):
    return [[west, south], [east, south], [east, north], [west, north], [west, south]]


@pytest.fixture
def locator(tmp_path):
    """
    Alpha covers longitude 0-4.5 (with a lake at 1-1.2), Beta 4.5-9.
    """

    path = tmp_path / "countries.geojson"
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"code": "AA", "name": "Alpha"},
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                square(0, 4.5),
                                square(1.0, 1.2, -0.1, 0.1),
                            ],
                        },
                    },
                    {
                        "type": "Feature",
                        "properties": {"code": "BB", "name": "Beta"},
                        "geometry": {
                            "type": "MultiPolygon",
                            "coordinates": [[square(4.5, 9.01)]],
                        },
                    },
                ],
            }
        ),
        encoding="utf-8",
    )

    return CountryLocator(path)


def test_locator_finds_countries_and_respects_holes(locator):
    assert locator.locate(0, 2) == ALPHA
    assert locator.locate(0, 6) == BETA
    assert locator.locate(0, 1.1) is None  # the lake
    assert locator.locate(5, 2) is None  # outside everything
    assert locator.by_code("BB") == BETA


def test_real_boundaries_locate_european_cities():
    locator = get_country_locator()

    assert locator.locate(48.2082, 16.3738).code == "AT"  # Vienna
    assert locator.locate(59.8586, 17.6389).code == "SE"  # Uppsala
    assert locator.locate(47.1410, 9.5209).code == "LI"  # Vaduz
    assert locator.locate(56.0, 3.0) is None  # North Sea


def test_country_stretches_split_route(locator):
    stretches = country_stretches(ROUTE, locator)

    assert [stretch.country for stretch in stretches] == [ALPHA, BETA]
    assert stretches[0].distance_km == pytest.approx(500, abs=3)
    assert stretches[1].start_km == pytest.approx(500, abs=3)
    # The lake (no country) counts as Alpha: no extra stretch.
    assert len(stretches) == 2


def test_route_starting_off_the_coastline_takes_first_country(locator):
    # Starts just outside Alpha (e.g. a harbour cut off by simplified
    # coastlines) - still counted as Alpha, not "no country".
    route = [(0.0, -0.05 + index / 100) for index in range(200)]

    stretches = country_stretches(route, locator)

    assert [stretch.country for stretch in stretches] == [ALPHA]
    assert stretches[0].start_km == 0


class BlipLocator:
    """Alpha everywhere except a 2 km sliver of Beta around km 300."""

    def locate(self, latitude, longitude):
        return BETA if 2.69 <= longitude <= 2.71 else ALPHA

    def by_code(self, code):
        return {"AA": ALPHA, "BB": BETA}.get(code)


def test_short_border_blips_are_merged():
    stretches = country_stretches(ROUTE, BlipLocator())

    assert [stretch.country for stretch in stretches] == [ALPHA]


class WideBlipLocator(BlipLocator):
    """A 10 km stretch of Beta: too long to merge, short enough to verify."""

    def locate(self, latitude, longitude):
        return BETA if 2.65 <= longitude <= 2.75 else ALPHA


def test_short_stretches_are_verified():
    calls = []

    def verify(latitude, longitude):
        calls.append(longitude)
        return "AA"

    stretches = country_stretches(ROUTE, WideBlipLocator(), verify_country=verify)

    assert len(calls) == 1
    assert calls[0] == pytest.approx(2.7, abs=0.05)
    assert [stretch.country for stretch in stretches] == [ALPHA]


def test_verification_failure_keeps_offline_answer():
    def verify(latitude, longitude):
        raise httpx.ConnectError("down")

    stretches = country_stretches(ROUTE, WideBlipLocator(), verify_country=verify)

    assert [stretch.country for stretch in stretches] == [ALPHA, BETA, ALPHA]


def test_border_provider_returns_country_names(locator):
    provider = NaturalEarthBorderProvider(locator)

    assert provider.get_countries(ROUTE) == ["Alpha", "Beta"]


def stretch(code, start, end):
    return CountryStretch(Country(code, code), start, end, (0, 0))


def test_road_fees_per_country():
    fees = calculate_road_fees(
        [
            stretch("DE", 0, 178),
            stretch("AT", 178, 222),
            stretch("IT", 222, 322),
            stretch("AT", 322, 330),
        ],
        [(0.0, 0.0), (0.0, 1.0)],
    )

    assert [(fee.country_code, fee.kind) for fee in fees] == [
        ("AT", "vignette"),
        ("IT", "distance"),
    ]
    assert fees[0].amount_eur == 12.8
    # 100 km at €0.08/km.
    assert fees[1].amount_eur == pytest.approx(8.0)
    assert "100 km" in fees[1].note


def test_fixed_tolls_detected_in_route_order():
    route = [
        (55.6761, 12.5683),  # Copenhagen
        (55.5769, 12.8189),  # on the Øresund Bridge
        (55.6050, 13.0038),  # Malmö
    ]

    tolls = fixed_tolls_on_route(route)

    assert [toll.name for toll in tolls] == ["Øresund Bridge"]
    assert fixed_tolls_on_route([(55.6761, 12.5683)]) == []


def test_fees_endpoint(client, test_user, locator):
    token = create_access_token(test_user.id)
    route = {
        "distance_meters": 1_000_000,
        "duration_seconds": 36_000,
        "points": [],
        "legs": [],
        "geometry": {
            "type": "LineString",
            "coordinates": [[longitude, latitude] for latitude, longitude in ROUTE],
        },
    }

    with (
        patch("app.api.v1.routes.preview_route", return_value=route),
        patch("app.api.v1.routes.get_country_locator", return_value=locator),
        patch("app.api.v1.routes.reverse_country_code", return_value=None),
    ):
        response = client.post(
            "/routes/fees",
            json={
                "start": {"location": "A", "latitude": 0, "longitude": 0},
                "destination": {"location": "B", "latitude": 0, "longitude": 9},
                "vehicle_type": "campervan",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert response.status_code == 200

    data = response.json()

    assert [country["code"] for country in data["countries"]] == ["AA", "BB"]
    assert data["crossings"][0]["from_country"] == "Alpha"
    assert data["crossings"][0]["to_country"] == "Beta"
    assert data["crossings"][0]["distance_from_start_km"] == pytest.approx(500, abs=3)
    # Made-up countries have no fee rules.
    assert data["fees"] == []
    assert data["total_eur"] == 0
    assert "3.5 t" in data["notes"][0]
