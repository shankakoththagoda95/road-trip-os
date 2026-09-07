import pytest
from unittest.mock import patch

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.base import Base
from app.models.user import User
from app.services.fuel_stations import FuelStationService
from app.integrations.fuel_stations import (
    FuelStation,
    FuelStationProvider,
    OverpassFuelStationProvider,
)
from fastapi.testclient import TestClient
from app.schemas.fuel_station import (
    FuelStationResponse,
    FuelStationRecommendationResponse,
)


def test_fuel_station_model():
    station = FuelStation(
        provider_id="test-123",
        name="Test Fuel Station",
        latitude=59.3293,
        longitude=18.0686,
        country="Sweden",
        fuel_types=["petrol", "diesel"],
    )

    assert station.provider_id == "test-123"
    assert station.name == "Test Fuel Station"
    assert station.latitude == 59.3293
    assert station.longitude == 18.0686
    assert station.country == "Sweden"
    assert station.fuel_types == ["petrol", "diesel"]


def test_fuel_station_provider_requires_implementation():
    provider = FuelStationProvider()

    try:
        provider.search_nearby(
            latitude=59.3293,
            longitude=18.0686,
            radius_km=10,
        )
    except NotImplementedError:
        pass
    else:
        raise AssertionError(
            "FuelStationProvider should require an implementation"
        )


def test_overpass_provider_rejects_invalid_latitude():
    provider = OverpassFuelStationProvider()

    with pytest.raises(ValueError):
        provider.search_nearby(
            latitude=91,
            longitude=18.0686,
            radius_km=5,
        )


def test_overpass_provider_rejects_invalid_longitude():
    provider = OverpassFuelStationProvider()

    with pytest.raises(ValueError):
        provider.search_nearby(
            latitude=59.3293,
            longitude=181,
            radius_km=5,
        )


def test_overpass_provider_rejects_invalid_radius():
    provider = OverpassFuelStationProvider()

    with pytest.raises(ValueError):
        provider.search_nearby(
            latitude=59.3293,
            longitude=18.0686,
            radius_km=0,
        )


def test_overpass_provider_converts_response_to_fuel_stations():
    provider = OverpassFuelStationProvider()

    fake_response = {
        "elements": [
            {
                "type": "node",
                "id": 12345,
                "lat": 59.3293,
                "lon": 18.0686,
                "tags": {
                    "name": "Test Fuel Station",
                    "addr:country": "SE",
                    "fuel:diesel": "yes",
                    "fuel:octane_95": "yes",
                },
            },
            {
                "type": "way",
                "id": 67890,
                "center": {
                    "lat": 59.3300,
                    "lon": 18.0700,
                },
                "tags": {
                    "name": "Second Fuel Station",
                    "fuel:e10": "yes",
                },
            },
        ]
    }

    with patch("httpx.get") as mock_get:
        mock_get.return_value.json.return_value = fake_response
        mock_get.return_value.raise_for_status.return_value = None

        stations = provider.search_nearby(
            latitude=59.3293,
            longitude=18.0686,
            radius_km=5,
        )

    assert len(stations) == 2

    first_station = stations[0]

    assert first_station.provider_id == "node/12345"
    assert first_station.name == "Test Fuel Station"
    assert first_station.latitude == 59.3293
    assert first_station.longitude == 18.0686
    assert first_station.country == "SE"
    assert first_station.fuel_types == [
        "diesel",
        "petrol_95",
    ]

    second_station = stations[1]

    assert second_station.provider_id == "way/67890"
    assert second_station.name == "Second Fuel Station"
    assert second_station.latitude == 59.3300
    assert second_station.longitude == 18.0700
    assert second_station.fuel_types == ["e10"]


def test_fuel_station_service_finds_nearby_stations():
    provider = OverpassFuelStationProvider()
    service = FuelStationService(provider)

    fake_response = {
        "elements": [
            {
                "type": "node",
                "id": 12345,
                "lat": 59.3293,
                "lon": 18.0686,
                "tags": {
                    "name": "Test Fuel Station",
                },
            }
        ]
    }

    with patch("httpx.get") as mock_get:
        mock_get.return_value.json.return_value = fake_response
        mock_get.return_value.raise_for_status.return_value = None

        stations = service.find_nearby(
            latitude=59.3293,
            longitude=18.0686,
            radius_km=5,
        )

    assert len(stations) == 1
    assert stations[0].name == "Test Fuel Station"


def test_nearby_fuel_stations_endpoint(client, test_user):
    token = create_access_token(test_user.id)

    fake_response = {
        "elements": [
            {
                "type": "node",
                "id": 12345,
                "lat": 59.3293,
                "lon": 18.0686,
                "tags": {
                    "name": "Test Fuel Station",
                    "addr:country": "SE",
                    "fuel:diesel": "yes",
                },
            }
        ]
    }

    with patch("httpx.get") as mock_get:
        mock_get.return_value.json.return_value = fake_response
        mock_get.return_value.raise_for_status.return_value = None

        response = client.get(
            "/fuel-stations/nearby",
            params={
                "latitude": 59.3293,
                "longitude": 18.0686,
                "radius_km": 5,
            },
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["name"] == "Test Fuel Station"
    assert data[0]["latitude"] == 59.3293
    assert data[0]["longitude"] == 18.0686
    assert data[0]["country"] == "SE"
    assert data[0]["fuel_types"] == ["diesel"]


def test_fuel_station_service_finds_nearest_station():
    stations = [
        FuelStation(
            provider_id="station-1",
            name="Far Station",
            latitude=59.35,
            longitude=18.10,
            country="SE",
            fuel_types=["diesel"],
        ),
        FuelStation(
            provider_id="station-2",
            name="Nearest Station",
            latitude=59.3300,
            longitude=18.0690,
            country="SE",
            fuel_types=["petrol_95"],
        ),
    ]

    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return stations

    service = FuelStationService(FakeProvider())

    nearest = service.find_nearest(
        latitude=59.3293,
        longitude=18.0686,
        radius_km=5,
    )

    assert nearest is not None
    assert nearest.provider_id == "station-2"
    assert nearest.name == "Nearest Station"


def test_fuel_station_service_returns_none_when_no_stations():
    class EmptyProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(EmptyProvider())

    nearest = service.find_nearest(
        latitude=59.3293,
        longitude=18.0686,
        radius_km=5,
    )

    assert nearest is None


def test_nearest_fuel_station_endpoint(client, test_user):
    token = create_access_token(test_user.id)

    fake_response = {
        "elements": [
            {
                "type": "node",
                "id": 100,
                "lat": 59.35,
                "lon": 18.10,
                "tags": {
                    "name": "Far Station",
                    "addr:country": "SE",
                    "fuel:diesel": "yes",
                },
            },
            {
                "type": "node",
                "id": 200,
                "lat": 59.3300,
                "lon": 18.0690,
                "tags": {
                    "name": "Nearest Station",
                    "addr:country": "SE",
                    "fuel:octane_95": "yes",
                },
            },
        ]
    }

    with patch("httpx.get") as mock_get:
        mock_get.return_value.json.return_value = fake_response
        mock_get.return_value.raise_for_status.return_value = None

        response = client.get(
            "/fuel-stations/nearest",
            params={
                "latitude": 59.3293,
                "longitude": 18.0686,
                "radius_km": 5,
            },
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert data["provider_id"] == "node/200"
    assert data["name"] == "Nearest Station"
    assert data["latitude"] == 59.3300
    assert data["longitude"] == 18.0690
    assert data["country"] == "SE"
    assert data["fuel_types"] == ["petrol_95"]


def test_fuel_station_service_finds_stations_along_route():
    stations = [
        FuelStation(
            provider_id="station-1",
            name="Along Route",
            latitude=59.3300,
            longitude=18.0690,
            country="SE",
            fuel_types=["diesel"],
        ),
        FuelStation(
            provider_id="station-2",
            name="Far From Route",
            latitude=59.50,
            longitude=18.50,
            country="SE",
            fuel_types=["petrol_95"],
        ),
    ]

    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return stations

    service = FuelStationService(FakeProvider())

    route_coordinates = [
        (59.3293, 18.0686),
        (59.3300, 18.0690),
        (59.3400, 18.0800),
    ]

    result = service.find_along_route(
        route_coordinates=route_coordinates,
    )

    assert len(result) == 1
    assert result[0].provider_id == "station-1"
    assert result[0].name == "Along Route"


def test_fuel_station_service_returns_empty_for_empty_route():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    result = service.find_along_route(
        route_coordinates=[],
    )

    assert result == []


def test_fuel_station_service_rejects_invalid_route_radius():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    with pytest.raises(ValueError):
        service.find_along_route(
            route_coordinates=[(59.3293, 18.0686)],
            search_radius_km=0,
        )


def test_fuel_stations_along_route_endpoint(client, test_user):
    token = create_access_token(test_user.id)

    fake_response = {
        "elements": [
            {
                "type": "node",
                "id": 300,
                "lat": 59.3300,
                "lon": 18.0690,
                "tags": {
                    "name": "Route Fuel Station",
                    "addr:country": "SE",
                    "fuel:diesel": "yes",
                },
            },
            {
                "type": "node",
                "id": 400,
                "lat": 59.50,
                "lon": 18.50,
                "tags": {
                    "name": "Far Fuel Station",
                    "addr:country": "SE",
                    "fuel:diesel": "yes",
                },
            },
        ]
    }

    with patch("httpx.get") as mock_get:
        mock_get.return_value.json.return_value = fake_response
        mock_get.return_value.raise_for_status.return_value = None

        response = client.post(
            "/fuel-stations/along-route",
            json={
                "route_coordinates": [
                    {
                        "latitude": 59.3293,
                        "longitude": 18.0686,
                    },
                    {
                        "latitude": 59.3300,
                        "longitude": 18.0690,
                    },
                ],
            },
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert len(data) == 1
    assert data[0]["provider_id"] == "node/300"
    assert data[0]["name"] == "Route Fuel Station"


def test_fuel_station_service_calculates_detour_distance():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    route_coordinates = [
        (59.3293, 18.0686),
        (59.3393, 18.0686),
    ]

    station = FuelStation(
        provider_id="station-1",
        name="Test Station",
        latitude=59.3343,
        longitude=18.0686,
        country="SE",
        fuel_types=["diesel"],
    )

    detour = service.calculate_detour_distance(
        route_coordinates=route_coordinates,
        station=station,
    )

    assert detour >= 0
    assert detour < 2.0


def test_fuel_station_service_rejects_route_with_less_than_two_points():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Test Station",
        latitude=59.3343,
        longitude=18.0686,
        country="SE",
        fuel_types=["diesel"],
    )

    with pytest.raises(ValueError):
        service.calculate_detour_distance(
            route_coordinates=[(59.3293, 18.0686)],
            station=station,
        )


def test_fuel_station_service_calculates_detour_to_middle_of_route_segment():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    route_coordinates = [
        (59.3293, 18.0686),
        (59.3493, 18.0686),
    ]

    station = FuelStation(
        provider_id="station-1",
        name="Middle Route Station",
        latitude=59.3393,
        longitude=18.0686,
        country="SE",
        fuel_types=["diesel"],
    )

    detour = service.calculate_detour_distance(
        route_coordinates=route_coordinates,
        station=station,
    )

    assert detour < 0.1


def test_fuel_station_detour_endpoint(client, test_user):
    token = create_access_token(test_user.id)

    response = client.post(
        "/fuel-stations/detour",
        json={
            "route_coordinates": [
                {
                    "latitude": 59.3293,
                    "longitude": 18.0686,
                },
                {
                    "latitude": 59.3493,
                    "longitude": 18.0686,
                },
            ],
            "station": {
                "provider_id": "station-1",
                "name": "Route Station",
                "latitude": 59.3393,
                "longitude": 18.0686,
                "country": "SE",
                "fuel_types": ["diesel"],
            },
        },
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert "detour_distance_km" in data
    assert data["detour_distance_km"] < 0.1


def test_fuel_station_service_can_reach_station():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Reachable Station",
        latitude=59.3300,
        longitude=18.0690,
        country="SE",
        fuel_types=["diesel"],
    )

    result = service.can_reach_station(
        current_location=(59.3293, 18.0686),
        station=station,
        current_fuel=40.0,
        consumption_l_per_100km=8.0,
    )

    assert result is True


def test_fuel_station_service_cannot_reach_station():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Unreachable Station",
        latitude=60.0,
        longitude=19.0,
        country="SE",
        fuel_types=["diesel"],
    )

    result = service.can_reach_station(
        current_location=(59.3293, 18.0686),
        station=station,
        current_fuel=5.0,
        consumption_l_per_100km=8.0,
    )

    assert result is False


def test_fuel_station_service_rejects_negative_current_fuel():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Test Station",
        latitude=59.3300,
        longitude=18.0690,
        country="SE",
        fuel_types=["diesel"],
    )

    with pytest.raises(ValueError):
        service.can_reach_station(
            current_location=(59.3293, 18.0686),
            station=station,
            current_fuel=-1.0,
            consumption_l_per_100km=8.0,
        )


def test_fuel_station_service_rejects_invalid_consumption():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Test Station",
        latitude=59.3300,
        longitude=18.0690,
        country="SE",
        fuel_types=["diesel"],
    )

    with pytest.raises(ValueError):
        service.can_reach_station(
            current_location=(59.3293, 18.0686),
            station=station,
            current_fuel=20.0,
            consumption_l_per_100km=0.0,
        )


def test_fuel_station_service_recommends_nearest_reachable_station():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    stations = [
        FuelStation(
            provider_id="station-1",
            name="Unreachable Station",
            latitude=60.0,
            longitude=19.0,
            country="SE",
            fuel_types=["diesel"],
        ),
        FuelStation(
            provider_id="station-2",
            name="Reachable Station",
            latitude=59.3300,
            longitude=18.0690,
            country="SE",
            fuel_types=["diesel"],
        ),
        FuelStation(
            provider_id="station-3",
            name="Farther Reachable Station",
            latitude=59.3400,
            longitude=18.0800,
            country="SE",
            fuel_types=["diesel"],
        ),
    ]

    recommendation = service.recommend_fuel_station(
        current_location=(59.3293, 18.0686),
        stations=stations,
        current_fuel=1.0,
        consumption_l_per_100km=8.0,
    )

    assert recommendation is not None
    assert recommendation.station.provider_id == "station-2"


def test_fuel_station_service_returns_none_when_no_station_is_reachable():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    stations = [
        FuelStation(
            provider_id="station-1",
            name="Far Station",
            latitude=60.0,
            longitude=19.0,
            country="SE",
            fuel_types=["diesel"],
        ),
    ]

    recommendation = service.recommend_fuel_station(
        current_location=(59.3293, 18.0686),
        stations=stations,
        current_fuel=1.0,
        consumption_l_per_100km=8.0,
    )

    assert recommendation is None


def test_fuel_station_service_prefers_closer_reachable_station():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    stations = [
        FuelStation(
            provider_id="station-1",
            name="Closer Station",
            latitude=59.3300,
            longitude=18.0690,
            country="SE",
            fuel_types=["diesel"],
        ),
        FuelStation(
            provider_id="station-2",
            name="Farther Station",
            latitude=59.3400,
            longitude=18.0800,
            country="SE",
            fuel_types=["diesel"],
        ),
    ]

    recommendation = service.recommend_fuel_station(
        current_location=(59.3293, 18.0686),
        stations=stations,
        current_fuel=20.0,
        consumption_l_per_100km=8.0,
    )

    assert recommendation is not None
    assert recommendation.station.provider_id == "station-1"


def test_fuel_station_service_can_reach_station_with_reserve():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Reachable Station",
        latitude=59.3300,
        longitude=18.0690,
        country="SE",
        fuel_types=["diesel"],
    )

    result = service.can_reach_station(
        current_location=(59.3293, 18.0686),
        station=station,
        current_fuel=40.0,
        consumption_l_per_100km=8.0,
        reserve_km=50.0,
    )

    assert result is True


def test_fuel_station_service_rejects_station_because_of_reserve():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Station",
        latitude=60.0,
        longitude=19.0,
        country="SE",
        fuel_types=["diesel"],
    )

    result = service.can_reach_station(
        current_location=(59.3293, 18.0686),
        station=station,
        current_fuel=10.0,
        consumption_l_per_100km=10.0,
        reserve_km=50.0,
    )

    assert result is False


def test_fuel_station_service_rejects_negative_reserve():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Station",
        latitude=59.3300,
        longitude=18.0690,
        country="SE",
        fuel_types=["diesel"],
    )

    with pytest.raises(ValueError):
        service.can_reach_station(
            current_location=(59.3293, 18.0686),
            station=station,
            current_fuel=20.0,
            consumption_l_per_100km=8.0,
            reserve_km=-1.0,
        )


def test_fuel_station_service_respects_reserve_when_recommending():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    stations = [
        FuelStation(
            provider_id="station-1",
            name="Too Close to Empty",
            latitude=59.3293,
            longitude=18.0686 + 0.6,
            country="SE",
            fuel_types=["diesel"],
        ),
        FuelStation(
            provider_id="station-2",
            name="Safe Station",
            latitude=59.3293,
            longitude=18.0686 + 0.2,
            country="SE",
            fuel_types=["diesel"],
        ),
    ]

    recommendation = service.recommend_fuel_station(
        current_location=(59.3293, 18.0686),
        stations=stations,
        current_fuel=5.0,
        consumption_l_per_100km=10.0,
        reserve_km=20.0,
    )

    assert recommendation is not None
    assert recommendation.station.provider_id == "station-2"


def test_fuel_station_recommendation_response_schema():
    response = FuelStationRecommendationResponse(
        station=FuelStationResponse(
            provider_id="station-1",
            name="Test Station",
            latitude=59.3293,
            longitude=18.0686,
            country="SE",
            fuel_types=["diesel"],
        ),
        distance_km=12.4,
        detour_distance_km=1.8,
        reserve_km=20.0,
    )

    assert response.station.name == "Test Station"
    assert response.distance_km == 12.4
    assert response.detour_distance_km == 1.8
    assert response.reserve_km == 20.0


def test_fuel_station_service_recommendation_includes_details():
    class FakeProvider(FuelStationProvider):
        def search_nearby(
            self,
            latitude: float,
            longitude: float,
            radius_km: float,
        ):
            return []

    service = FuelStationService(FakeProvider())

    station = FuelStation(
        provider_id="station-1",
        name="Recommended Station",
        latitude=59.3300,
        longitude=18.0690,
        country="SE",
        fuel_types=["diesel"],
    )

    recommendation = service.recommend_fuel_station(
        current_location=(59.3293, 18.0686),
        stations=[station],
        current_fuel=20.0,
        consumption_l_per_100km=8.0,
        reserve_km=20.0,
    )

    assert recommendation is not None
    assert recommendation.station.provider_id == "station-1"
    assert recommendation.distance_km > 0
    assert recommendation.detour_distance_km > 0
    assert recommendation.reserve_km == 20.0


def test_fuel_station_recommendation_endpoint(client, test_user):
    token = create_access_token(test_user.id)

    response = client.post(
        "/fuel-stations/recommend",
        json={
            "current_location": {
                "latitude": 59.3293,
                "longitude": 18.0686,
            },
            "stations": [
                {
                    "provider_id": "station-1",
                    "name": "Recommended Station",
                    "latitude": 59.3300,
                    "longitude": 18.0690,
                    "country": "SE",
                    "fuel_types": ["diesel"],
                },
                {
                    "provider_id": "station-2",
                    "name": "Far Station",
                    "latitude": 60.0,
                    "longitude": 19.0,
                    "country": "SE",
                    "fuel_types": ["diesel"],
                },
            ],
            "current_fuel": 20.0,
            "consumption_l_per_100km": 8.0,
            "reserve_km": 20.0,
        },
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["station"]["provider_id"] == "station-1"
    assert data["station"]["name"] == "Recommended Station"
    assert data["distance_km"] > 0
    assert data["detour_distance_km"] > 0
    assert data["reserve_km"] == 20.0


def test_fuel_station_service_recommendation_uses_route_aware_detour():
    service = FuelStationService(
        provider=None,
    )

    station = FuelStation(
        provider_id="station-1",
        name="Route Station",
        latitude=59.005,
        longitude=18.005,
        country="SE",
        fuel_types=["petrol_95"],
    )

    route_coordinates = [
        (59.0, 18.0),
        (59.0, 18.01),
        (59.01, 18.01),
    ]

    recommendation = service.recommend_fuel_station(
        current_location=(59.0, 18.0),
        stations=[station],
        current_fuel=20.0,
        consumption_l_per_100km=5.0,
        route_coordinates=route_coordinates,
    )

    assert recommendation is not None

    expected_detour = service.calculate_detour_distance(
        route_coordinates=route_coordinates,
        station=station,
    )

    assert recommendation.detour_distance_km == pytest.approx(
        expected_detour
    )