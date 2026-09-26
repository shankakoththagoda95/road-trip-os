from unittest.mock import patch

import pytest

from app.core.security import create_access_token
from app.integrations.ev_charging import EVChargingStation
from app.integrations.fuel_stations import FuelStation
from app.services.geography import calculate_distance_km
from app.services.nearest_station import find_nearest_expanding

HOME = (52.0, 10.0)


def point_at_km(km: float) -> tuple[float, float]:
    """A point `km` due north of HOME."""
    return HOME[0] + km / 111.195, HOME[1]


def fuel(name: str, km: float) -> FuelStation:
    latitude, longitude = point_at_km(km)
    return FuelStation(
        provider_id=f"node/{name}",
        name=name,
        latitude=latitude,
        longitude=longitude,
        country=None,
        fuel_types=["diesel"],
    )


class FakeProvider:
    """Returns the stations inside the requested radius, like the real APIs."""

    def __init__(self, stations):
        self.stations = stations
        self.radii = []

    def search_nearby(self, latitude, longitude, radius_km):
        self.radii.append(radius_km)
        return [
            station
            for station in self.stations
            if calculate_distance_km(latitude, longitude, station.latitude, station.longitude)
            <= radius_km
        ]


def one_km_at_a_time(stations, max_km=50):
    """The literal algorithm: grow 1 km per step."""
    provider = FakeProvider(stations)
    for radius in range(1, max_km + 1):
        found = provider.search_nearby(*HOME, radius)
        if found:
            return radius, sorted(station.name for station in found)
    return None


@pytest.mark.parametrize(
    "distances",
    [[0.4], [3.4, 3.9, 7.0], [4.9, 5.0], [5.2, 12.0], [26.5, 30.0], [49.2], [0.9, 1.0, 1.1]],
)
def test_same_answer_as_growing_one_km_at_a_time(distances):
    stations = [fuel(f"S{index}", km) for index, km in enumerate(distances)]
    expected_radius, expected_names = one_km_at_a_time(stations)

    result = find_nearest_expanding(FakeProvider(stations), *HOME)

    assert result.radius_km == expected_radius
    assert sorted(nearby.station.name for nearby in result.stations) == expected_names


def test_nearest_first_with_distances_and_few_requests():
    provider = FakeProvider([fuel("Far", 3.8), fuel("Near", 3.1), fuel("Out", 8.0)])

    result = find_nearest_expanding(provider, *HOME)

    assert result.radius_km == 4
    assert [nearby.station.name for nearby in result.stations] == ["Near", "Far"]
    assert result.stations[0].distance_km == pytest.approx(3.1, abs=0.01)
    # Asked for 1 km, then 5 km; not once per kilometre.
    assert provider.radii == [1, 5]


def test_nothing_within_the_limit():
    provider = FakeProvider([fuel("Remote", 80)])

    assert find_nearest_expanding(provider, *HOME) is None
    assert provider.radii == [1, 5, 10, 25, 50]


def test_smaller_limit_is_respected():
    provider = FakeProvider([fuel("S", 7.5)])

    assert find_nearest_expanding(provider, *HOME, max_radius_km=7) is None
    assert provider.radii == [1, 5, 7]


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


def test_fuel_endpoint(client, auth_headers):
    provider = FakeProvider([fuel("Aral", 2.3)])

    with patch("app.api.v1.stations.OverpassFuelStationProvider", return_value=provider):
        body = client.get(
            "/stations/nearest",
            params={"latitude": HOME[0], "longitude": HOME[1], "kind": "fuel"},
            headers=auth_headers,
        ).json()

    assert body["kind"] == "fuel"
    assert body["radius_km"] == 3
    assert body["stations"][0]["name"] == "Aral"
    assert body["stations"][0]["details"] == ["diesel"]


def test_charging_endpoint(client, auth_headers):
    latitude, longitude = point_at_km(0.6)
    charger = EVChargingStation(
        provider_id="123",
        name="Ionity",
        latitude=latitude,
        longitude=longitude,
        country="DE",
        operator="IONITY",
        connector_types=["CCS (Type 2)", "CCS (Type 2)", "Type 2"],
        charging_power_kw=350,
    )

    with patch(
        "app.api.v1.stations.OpenChargeMapProvider", return_value=FakeProvider([charger])
    ):
        body = client.get(
            "/stations/nearest",
            params={"latitude": HOME[0], "longitude": HOME[1], "kind": "charging"},
            headers=auth_headers,
        ).json()

    assert body["radius_km"] == 1
    station = body["stations"][0]
    assert (station["operator"], station["power_kw"]) == ("IONITY", 350)
    assert station["details"] == ["CCS (Type 2)", "Type 2"]


def test_none_found_endpoint(client, auth_headers):
    with patch(
        "app.api.v1.stations.OverpassFuelStationProvider", return_value=FakeProvider([])
    ):
        body = client.get(
            "/stations/nearest",
            params={"latitude": HOME[0], "longitude": HOME[1]},
            headers=auth_headers,
        ).json()

    assert body == {"kind": "fuel", "radius_km": None, "searched_up_to_km": 50, "stations": []}


def test_charging_without_key_is_503(client, auth_headers):
    with patch(
        "app.api.v1.stations.OpenChargeMapProvider", side_effect=RuntimeError("no key")
    ):
        response = client.get(
            "/stations/nearest",
            params={"latitude": HOME[0], "longitude": HOME[1], "kind": "charging"},
            headers=auth_headers,
        )

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "charging_not_configured"


def test_needs_login(client):
    response = client.get("/stations/nearest", params={"latitude": 52, "longitude": 10})

    assert response.status_code == 401


def test_overpass_retries_once_when_busy():
    from unittest.mock import MagicMock

    from app.integrations.fuel_stations import OverpassFuelStationProvider

    busy = MagicMock(status_code=504)
    ok = MagicMock(status_code=200)
    ok.json.return_value = {
        "elements": [{"type": "node", "id": 1, "lat": 52.0, "lon": 10.0, "tags": {"name": "Aral"}}]
    }

    with (
        patch("app.integrations.fuel_stations.httpx.post", side_effect=[busy, ok]) as post,
        patch("app.integrations.fuel_stations.time.sleep") as sleep,
    ):
        stations = OverpassFuelStationProvider().search_nearby(52.0, 10.0, 1)

    assert [station.name for station in stations] == ["Aral"]
    assert post.call_count == 2
    sleep.assert_called_once()


def test_overpass_gives_up_after_the_retry():
    import httpx as httpx_module
    from unittest.mock import MagicMock

    from app.integrations.fuel_stations import OverpassFuelStationProvider

    busy = MagicMock(status_code=504)
    busy.raise_for_status.side_effect = httpx_module.HTTPStatusError(
        "busy", request=MagicMock(), response=busy
    )

    with (
        patch("app.integrations.fuel_stations.httpx.post", return_value=busy) as post,
        patch("app.integrations.fuel_stations.time.sleep"),
        pytest.raises(httpx_module.HTTPStatusError),
    ):
        OverpassFuelStationProvider().search_nearby(52.0, 10.0, 1)

    assert post.call_count == 2


def test_duplicate_fuel_station_entries_are_merged():
    from app.services.nearest_station import merge_duplicate_fuel_stations

    point = fuel("Aral", 0.84)
    # The same station as a building outline, 10 m away, with a longer name.
    building = FuelStation(
        provider_id="way/9",
        name="Aral Tankstelle Oberwöhr",
        latitude=point.latitude + 0.00009,
        longitude=point.longitude,
        country="DE",
        fuel_types=["petrol_95", "diesel"],
    )
    other = fuel("Shell", 0.95)

    merged = merge_duplicate_fuel_stations([point, building, other])

    assert [station.name for station in merged] == ["Aral Tankstelle Oberwöhr", "Shell"]
    assert merged[0].fuel_types == ["diesel", "petrol_95"]
    assert merged[0].country == "DE"
    # The provider's objects aren't changed.
    assert point.fuel_types == ["diesel"]


def test_search_reports_duplicates_once():
    point = fuel("Aral", 0.84)
    twin = FuelStation(
        provider_id="way/9",
        name="Unnamed fuel station",
        latitude=point.latitude + 0.0001,
        longitude=point.longitude,
        country=None,
        fuel_types=["e10"],
    )

    result = find_nearest_expanding(FakeProvider([point, twin]), *HOME)

    assert len(result.stations) == 1
    assert result.stations[0].station.name == "Aral"
    assert result.stations[0].station.fuel_types == ["diesel", "e10"]


def charger(name, km, connectors, power, operator="IONITY", east_m=0.0):
    latitude, longitude = point_at_km(km)
    return EVChargingStation(
        provider_id=f"{name}-{km}-{east_m}",
        name=name,
        latitude=latitude,
        longitude=longitude + east_m / 68_000,
        country="DE",
        operator=operator,
        connector_types=connectors,
        charging_power_kw=power,
    )


def test_same_charging_site_listed_twice_is_merged():
    from app.services.nearest_station import merge_duplicate_chargers

    first = charger("Chiemseestraße 37", 0.89, ["Type 2"], 22)
    again = charger("Chiemseestraße 37", 0.89, ["CCS (Type 2)"], 50, east_m=5)
    neighbour = charger("Supermarket", 0.89, ["Type 2"], 11, east_m=8)

    merged = merge_duplicate_chargers([first, again, neighbour])

    assert [station.name for station in merged] == ["Chiemseestraße 37", "Supermarket"]
    assert merged[0].connector_types == ["Type 2", "CCS (Type 2)"]
    assert merged[0].charging_power_kw == 50
    assert first.connector_types == ["Type 2"]


def test_placeholder_operator_is_hidden(client, auth_headers):
    site = charger("Rathaus", 0.3, ["Type 2"], 22, operator="(Business Owner at Location)")

    with patch("app.api.v1.stations.OpenChargeMapProvider", return_value=FakeProvider([site])):
        body = client.get(
            "/stations/nearest",
            params={"latitude": HOME[0], "longitude": HOME[1], "kind": "charging"},
            headers=auth_headers,
        ).json()

    assert body["stations"][0]["operator"] is None
