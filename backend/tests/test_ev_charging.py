import pytest
from app.integrations.ev_charging import (
    EVChargingStation,
    EVChargingStationProvider,
    OpenChargeMapProvider,
)
from app.schemas.ev_charging import (
    EVChargingStationResponse,
    EVChargingStationsNearbyRequest,
)
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


@pytest.mark.parametrize(
    "payload",
    [
        {
            "latitude": 91.0,
            "longitude": 18.0,
            "radius_km": 10.0,
        },
        {
            "latitude": 59.3293,
            "longitude": 181.0,
            "radius_km": 10.0,
        },
        {
            "latitude": 59.3293,
            "longitude": 18.0686,
            "radius_km": 0,
        },
    ],
)
def test_nearby_ev_charging_stations_endpoint_rejects_invalid_request(
    client,
    test_user,
    payload,
):
    response = client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": "password123",
        },
    )

    assert response.status_code == 200

    token = response.json()["access_token"]

    response = client.post(
        "/ev-charging/nearby",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json=payload,
    )

    assert response.status_code == 422


def test_ev_charging_station_model():
    station = EVChargingStation(
        provider_id="ocm-12345",
        name="Test Charging Station",
        latitude=59.3293,
        longitude=18.0686,
        country="SE",
        operator="Test Operator",
        connector_types=["CCS", "Type 2"],
        charging_power_kw=150.0,
    )

    assert station.provider_id == "ocm-12345"
    assert station.name == "Test Charging Station"
    assert station.latitude == 59.3293
    assert station.longitude == 18.0686
    assert station.country == "SE"
    assert station.operator == "Test Operator"
    assert station.connector_types == ["CCS", "Type 2"]
    assert station.charging_power_kw == 150.0


def test_ev_charging_station_provider_requires_implementation():
    provider = EVChargingStationProvider()

    try:
        provider.search_nearby(
            latitude=59.3293,
            longitude=18.0686,
            radius_km=5.0,
        )
    except NotImplementedError:
        return

    assert False, "Provider should require an implementation"


def test_open_charge_map_provider_requires_api_key(monkeypatch):
    monkeypatch.delenv(
        "OPEN_CHARGE_MAP_API_KEY",
        raising=False,
    )

    with pytest.raises(
        RuntimeError,
        match="OPEN_CHARGE_MAP_API_KEY",
    ):
        OpenChargeMapProvider()


def test_open_charge_map_provider_converts_response_to_ev_charging_stations(
    monkeypatch,
):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return [
                {
                    "ID": 12345,
                    "AddressInfo": {
                        "Title": "Test EV Station",
                        "Latitude": 59.3293,
                        "Longitude": 18.0686,
                        "Country": {
                            "ISOCode": "SE",
                        },
                    },
                    "OperatorInfo": {
                        "Title": "Test Operator",
                    },
                    "Connections": [
                        {
                            "ConnectionType": {
                                "Title": "CCS (Type 2)",
                            },
                            "PowerKW": 150,
                        },
                        {
                            "ConnectionType": {
                                "Title": "Type 2",
                            },
                            "PowerKW": 22,
                        },
                    ],
                }
            ]

    def fake_get(*args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr(
        "app.integrations.ev_charging.httpx.get",
        fake_get,
    )

    provider = OpenChargeMapProvider()

    stations = provider.search_nearby(
        latitude=59.3293,
        longitude=18.0686,
        radius_km=10,
    )

    assert len(stations) == 1

    station = stations[0]

    assert station.provider_id == "12345"
    assert station.name == "Test EV Station"
    assert station.latitude == 59.3293
    assert station.longitude == 18.0686
    assert station.country == "SE"
    assert station.operator == "Test Operator"
    assert station.connector_types == [
        "CCS (Type 2)",
        "Type 2",
    ]
    assert station.charging_power_kw == 150


def test_open_charge_map_provider_ignores_unknown_connector_types(
    monkeypatch,
):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return [
                {
                    "ID": 54321,
                    "AddressInfo": {
                        "Title": "Incomplete EV Station",
                        "Latitude": 59.3293,
                        "Longitude": 18.0686,
                        "Country": {
                            "ISOCode": "SE",
                        },
                    },
                    "Connections": [
                        {
                            "ConnectionType": {
                                "Title": "Unknown",
                            },
                            "PowerKW": 3.7,
                        },
                        {
                            "ConnectionType": {
                                "Title": "CCS (Type 2)",
                            },
                            "PowerKW": 150,
                        },
                    ],
                }
            ]

    def fake_get(*args, **kwargs):
        return FakeResponse()

    monkeypatch.setattr(
        "app.integrations.ev_charging.httpx.get",
        fake_get,
    )

    provider = OpenChargeMapProvider()

    stations = provider.search_nearby(
        latitude=59.3293,
        longitude=18.0686,
        radius_km=10,
    )

    assert len(stations) == 1

    station = stations[0]

    assert station.connector_types == ["CCS (Type 2)"]


def test_ev_charging_station_response_schema():
    station = EVChargingStationResponse(
        provider_id="12345",
        name="Test Charging Station",
        latitude=59.3293,
        longitude=18.0686,
        country="SE",
        operator="Test Operator",
        connector_types=["CCS (Type 2)", "Type 2"],
        charging_power_kw=150.0,
    )

    assert station.provider_id == "12345"
    assert station.name == "Test Charging Station"
    assert station.connector_types == [
        "CCS (Type 2)",
        "Type 2",
    ]
    assert station.charging_power_kw == 150.0


def test_ev_charging_stations_nearby_request_schema():
    request = EVChargingStationsNearbyRequest(
        latitude=59.3293,
        longitude=18.0686,
        radius_km=10.0,
    )

    assert request.latitude == 59.3293
    assert request.longitude == 18.0686
    assert request.radius_km == 10.0


@pytest.mark.parametrize(
    "latitude,longitude",
    [
        (-91.0, 18.0),
        (91.0, 18.0),
        (59.0, -181.0),
        (59.0, 181.0),
    ],
)
def test_ev_charging_stations_nearby_request_rejects_invalid_coordinates(
    latitude,
    longitude,
):
    with pytest.raises(ValueError):
        EVChargingStationsNearbyRequest(
            latitude=latitude,
            longitude=longitude,
            radius_km=10.0,
        )


def test_ev_charging_stations_nearby_request_rejects_invalid_radius():
    with pytest.raises(ValueError):
        EVChargingStationsNearbyRequest(
            latitude=59.3293,
            longitude=18.0686,
            radius_km=0,
        )


def test_nearby_ev_charging_stations_endpoint_requires_authentication():
    client = TestClient(app)

    response = client.post(
        "/ev-charging/nearby",
        json={
            "latitude": 59.3293,
            "longitude": 18.0686,
            "radius_km": 10,
        },
    )

    assert response.status_code == 401


def test_nearby_ev_charging_stations_endpoint(
    client,
    test_user,
):
    response = client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": "password123",
        },
    )

    assert response.status_code == 200

    token = response.json()["access_token"]

    with patch(
        "app.api.v1.ev_charging.OpenChargeMapProvider.search_nearby"
    ) as mock_search:
        mock_search.return_value = [
            EVChargingStation(
                provider_id="12345",
                name="Test EV Station",
                latitude=59.3293,
                longitude=18.0686,
                country="SE",
                operator="Test Operator",
                connector_types=["CCS (Type 2)"],
                charging_power_kw=150.0,
            )
        ]

        response = client.post(
            "/ev-charging/nearby",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "latitude": 59.3293,
                "longitude": 18.0686,
                "radius_km": 10,
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["provider_id"] == "12345"
    assert data[0]["name"] == "Test EV Station"
    assert data[0]["country"] == "SE"
    assert data[0]["connector_types"] == ["CCS (Type 2)"]
    assert data[0]["charging_power_kw"] == 150.0

    mock_search.assert_called_once_with(
        latitude=59.3293,
        longitude=18.0686,
        radius_km=10.0,
    )


def test_open_charge_map_provider_finds_stations_along_route(
    monkeypatch,
):
    station_one = EVChargingStation(
        provider_id="1",
        name="Station One",
        latitude=59.3293,
        longitude=18.0686,
        country="SE",
        operator="Operator One",
        connector_types=["CCS"],
        charging_power_kw=150.0,
    )

    station_two = EVChargingStation(
        provider_id="2",
        name="Station Two",
        latitude=59.3300,
        longitude=18.0700,
        country="SE",
        operator="Operator Two",
        connector_types=["CCS"],
        charging_power_kw=100.0,
    )

    calls = []

    def fake_search_nearby(
        self,
        latitude,
        longitude,
        radius_km,
    ):
        calls.append(
            (latitude, longitude, radius_km)
        )
    
        if latitude == 59.3293:
            return [station_one]

    return [station_two]

    monkeypatch.setattr(
        OpenChargeMapProvider,
        "search_nearby",
        fake_search_nearby,
    )

    provider = OpenChargeMapProvider()

    route_coordinates = [
        (59.3293, 18.0686),
        (59.3300, 18.0700),
    ]

    stations = provider.find_along_route(
        route_coordinates=route_coordinates,
        search_radius_km=2.0,
    )

    assert stations == [
        station_one,
        station_two,
    ]

    assert calls == [
        (59.3293, 18.0686, 2.0),
        (59.3300, 18.0700, 2.0),
    ]


def test_open_charge_map_provider_find_along_route_returns_empty_for_empty_route():
    provider = OpenChargeMapProvider()

    assert provider.find_along_route(
        route_coordinates=[],
        search_radius_km=2.0,
    ) == []


def test_open_charge_map_provider_find_along_route_rejects_invalid_radius():
    provider = OpenChargeMapProvider()

    with pytest.raises(ValueError):
        provider.find_along_route(
            route_coordinates=[
                (59.3293, 18.0686),
            ],
            search_radius_km=0,
        )