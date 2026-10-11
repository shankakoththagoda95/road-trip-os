from unittest.mock import patch

import pytest

from app.core.security import create_access_token
from app.models.vehicle import Vehicle
from app.services.geography import calculate_distance_km
from app.services.energy_stops import (
    EnergyStation,
    VehicleEnergyProfile,
    cumulative_distances,
    plan_energy_stops,
    point_at_distance,
    search_levels,
    vehicle_energy_profile,
)


# Straight line along the equator, one point every 0.1° (~11.1 km),
# about 1,000 km in total.
ROUTE = [(0.0, index / 10) for index in range(91)]


def station_at(latitude, longitude, name="Station"):
    return EnergyStation(
        provider_id=f"{latitude},{longitude}",
        name=name,
        latitude=latitude,
        longitude=longitude + 0.01,
        details=["diesel"],
    )


def always_find(latitude, longitude, radius_km=None):
    return [station_at(latitude, longitude)]


def profile(
    full=400.0,
    initial=400.0,
    refill=400.0,
    reserve=60.0,
    mode="fuel",
):
    return VehicleEnergyProfile(
        mode=mode,
        full_range_km=full,
        initial_range_km=initial,
        refill_range_km=refill,
        reserve_km=reserve,
    )


# A finer route (a point every ~1.1 km) for checking where stops land.
FINE_ROUTE = [(0.0, index / 100) for index in range(901)]
FINE_DISTANCES = cumulative_distances(FINE_ROUTE)
KM_PER_DEGREE = 111.195


def route_point(km):
    return point_at_distance(FINE_ROUTE, FINE_DISTANCES, km)


class StationMap:
    """Fixed stations; answers like the real APIs (within the radius)."""

    def __init__(self, *positions):
        self.stations = [
            EnergyStation(f"s{index}", f"Station {index}", latitude, longitude)
            for index, (latitude, longitude) in enumerate(positions)
        ]
        self.searches = []

    def __call__(self, latitude, longitude, radius_km):
        self.searches.append(radius_km)
        return [
            station
            for station in self.stations
            if calculate_distance_km(latitude, longitude, station.latitude, station.longitude)
            <= radius_km
        ]


def north_of(point, km):
    return point[0] + km / KM_PER_DEGREE, point[1]


def test_search_levels_follow_the_rules():
    assert search_levels(15) == [
        (15, 3), (20, 3), (25, 3), (30, 3), (35, 3), (40, 3),
        (10, 5), (5, 5),
    ]


def test_cumulative_distances_along_equator():
    distances = cumulative_distances(ROUTE)

    assert distances[0] == 0
    assert distances[-1] == pytest.approx(1000.8, abs=1)


def test_no_stops_when_range_covers_route():
    plan = plan_energy_stops(ROUTE, profile(initial=1200), always_find)

    assert plan.stops == []
    assert plan.warnings == []


def test_stops_when_the_tank_reaches_15_percent():
    plan = plan_energy_stops(ROUTE, profile(), always_find)

    # 400 km range, 15% (60 km) reserve: a stop every 340 km.
    assert [round(stop.distance_from_start_km) for stop in plan.stops] == [340, 680]
    assert [stop.level_percent for stop in plan.stops] == [15, 15]
    assert plan.stops[0].search_radius_km == 2  # the test station is 1.1 km off


def test_radius_grows_1_km_at_a_time_up_to_3_km():
    finder = StationMap(north_of(route_point(340), 2.4))

    plan = plan_energy_stops(FINE_ROUTE, profile(initial=400, refill=1000), finder)

    stop = plan.stops[0]
    assert stop.level_percent == 15
    assert stop.search_radius_km == 3
    assert stop.distance_from_route_km == pytest.approx(2.4, abs=0.6)


def test_looks_5_percent_earlier_when_nothing_is_within_3_km():
    # Only a station at the 20% point (km 320).
    finder = StationMap(route_point(320))

    plan = plan_energy_stops(FINE_ROUTE, profile(initial=400, refill=1000), finder)

    assert plan.stops[0].level_percent == 20
    assert round(plan.stops[0].distance_from_start_km) == 320
    assert plan.stops[0].search_radius_km == 1


def test_up_to_40_percent_before_looking_later():
    # The 40% point is km 240; the 10% point (km 360) has a station 4 km away.
    finder = StationMap(route_point(240), north_of(route_point(360), 4))

    plan = plan_energy_stops(FINE_ROUTE, profile(initial=400, refill=1000), finder)

    assert plan.stops[0].level_percent == 40


def test_last_resort_is_later_with_up_to_5_km():
    # 4 km off the route at the 10% point: too far for 3 km searches.
    finder = StationMap(north_of(route_point(360), 4))

    plan = plan_energy_stops(FINE_ROUTE, profile(initial=400, refill=1000), finder)

    stop = plan.stops[0]
    assert stop.level_percent == 10
    assert round(stop.distance_from_start_km) == 360
    assert stop.search_radius_km == 4
    # 15..40% at up to 3 km, then 10% at up to 5 km.
    assert finder.searches == [3, 3, 3, 3, 3, 3, 5]


def test_a_busy_service_moves_on_to_the_next_level():
    import httpx

    stations = StationMap(route_point(320))

    def flaky(latitude, longitude, radius_km):
        if not stations.searches:
            stations.searches.append("busy")
            raise httpx.HTTPError("429")
        return stations(latitude, longitude, radius_km)

    plan = plan_energy_stops(FINE_ROUTE, profile(initial=400, refill=1000), flaky)

    assert plan.stops[0].level_percent == 20
    assert plan.warnings == []


def test_uses_nearest_station_to_the_route():
    def find(latitude, longitude, radius_km):
        return [
            EnergyStation("far", "Far", latitude, longitude + 0.02),
            EnergyStation("near", "Near", latitude, longitude + 0.005),
        ]

    plan = plan_energy_stops(ROUTE, profile(initial=600), find)

    assert plan.stops[0].station.name == "Near"


def test_warns_when_no_station_is_found_at_any_level():
    plan = plan_energy_stops(
        ROUTE,
        profile(initial=600, refill=600),
        lambda *_: [],
    )

    assert len(plan.stops) == 1
    assert plan.stops[0].station is None
    assert plan.warnings == [
        "No station found near km 540, even looking from 40% down to 5% left"
    ]


def test_low_starting_level_plans_stop_at_start():
    plan = plan_energy_stops(ROUTE, profile(initial=30), always_find)

    # Already below 15%: look for a station where the trip starts.
    assert plan.stops[0].distance_from_start_km == 0
    assert plan.stops[0].level_percent == 7.5


def test_rejects_refill_below_reserve():
    with pytest.raises(ValueError):
        plan_energy_stops(ROUTE, profile(refill=40), always_find)


def make_vehicle(**overrides):
    values = {
        "user_id": 1,
        "name": "Test",
        "vehicle_type": "car",
        "fuel_type": "petrol",
        "fuel_consumption": 6.0,
        "tank_capacity": 60.0,
        "battery_capacity": None,
        "energy_consumption": None,
    }

    return Vehicle(**{**values, **overrides})


def test_fuel_profile_uses_tank_range():
    result = vehicle_energy_profile(
        make_vehicle(),
        start_level_percent=50,
        reserve_percent=10,
        refill_to_percent=None,
    )

    assert result.mode == "fuel"
    assert result.full_range_km == pytest.approx(1000)
    assert result.initial_range_km == pytest.approx(500)
    assert result.refill_range_km == pytest.approx(1000)
    assert result.reserve_km == pytest.approx(100)


def test_ev_profile_charges_to_80_percent_by_default():
    result = vehicle_energy_profile(
        make_vehicle(
            fuel_type="electric",
            fuel_consumption=None,
            tank_capacity=None,
            battery_capacity=75.0,
            energy_consumption=15.0,
        ),
        start_level_percent=100,
        reserve_percent=20,
        refill_to_percent=None,
    )

    assert result.mode == "ev"
    assert result.full_range_km == pytest.approx(500)
    assert result.refill_range_km == pytest.approx(400)


def test_plug_in_hybrid_starts_with_electric_range():
    result = vehicle_energy_profile(
        make_vehicle(
            fuel_type="plug_in_hybrid",
            battery_capacity=10.0,
            energy_consumption=20.0,
        ),
        start_level_percent=100,
        reserve_percent=10,
        refill_to_percent=None,
    )

    assert result.mode == "fuel"
    assert result.initial_range_km == pytest.approx(1050)


@pytest.mark.parametrize(
    "overrides",
    [
        {"tank_capacity": None},
        {
            "fuel_type": "electric",
            "battery_capacity": None,
            "energy_consumption": 15.0,
        },
    ],
)
def test_profile_requires_range_data(overrides):
    with pytest.raises(ValueError):
        vehicle_energy_profile(
            make_vehicle(**overrides),
            start_level_percent=100,
            reserve_percent=10,
            refill_to_percent=None,
        )


# --- API ---

MOCK_ROUTE = {
    "distance_meters": 1_000_000,
    "duration_seconds": 36_000,
    "points": [],
    "legs": [],
    "geometry": {
        "type": "LineString",
        "coordinates": [[longitude, latitude] for latitude, longitude in ROUTE],
    },
}

REQUEST = {
    "start": {"location": "A", "latitude": 0, "longitude": 0},
    "destination": {"location": "B", "latitude": 0, "longitude": 9},
}


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


@pytest.fixture
def vehicle(db, test_user):
    # 60 L at 15 L/100 km → 400 km range.
    vehicle = make_vehicle(
        user_id=test_user.id,
        fuel_consumption=15.0,
        tank_capacity=60.0,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    return vehicle


def test_energy_stops_endpoint_plans_fuel_stops(client, auth_headers, vehicle):
    with (
        patch("app.api.v1.routes.preview_route", return_value=MOCK_ROUTE),
        patch(
            "app.api.v1.routes.fuel_station_finder",
            return_value=always_find,
        ),
    ):
        response = client.post(
            "/routes/energy-stops",
            json={
                **REQUEST,
                "vehicle_id": vehicle.id,
                "reserve_percent": 12.5,
            },
            headers=auth_headers,
        )

    assert response.status_code == 200

    data = response.json()

    assert data["mode"] == "fuel"
    assert data["full_range_km"] == pytest.approx(400)
    assert [round(stop["distance_from_start_km"]) for stop in data["stops"]] == [
        350,
        700,
    ]
    assert data["stops"][0]["station"]["details"] == ["diesel"]
    assert data["warnings"] == []


def test_energy_stops_rejects_other_users_vehicle(client, auth_headers, db):
    other = make_vehicle(user_id=999)
    db.add(other)
    db.commit()

    response = client.post(
        "/routes/energy-stops",
        json={**REQUEST, "vehicle_id": other.id},
        headers=auth_headers,
    )

    assert response.status_code == 404


def test_energy_stops_returns_400_without_range_data(
    client,
    auth_headers,
    db,
    test_user,
):
    vehicle = make_vehicle(user_id=test_user.id, tank_capacity=None)
    db.add(vehicle)
    db.commit()

    response = client.post(
        "/routes/energy-stops",
        json={**REQUEST, "vehicle_id": vehicle.id},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert "tank size" in response.json()["detail"]
