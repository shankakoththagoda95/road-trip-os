from unittest.mock import patch

import pytest

from app.core.security import create_access_token
from app.models.vehicle import Vehicle
from app.services.energy_stops import (
    EnergyStation,
    VehicleEnergyProfile,
    cumulative_distances,
    plan_energy_stops,
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


def always_find(latitude, longitude):
    return [station_at(latitude, longitude)]


def profile(
    full=400.0,
    initial=400.0,
    refill=400.0,
    reserve=50.0,
    mode="fuel",
):
    return VehicleEnergyProfile(
        mode=mode,
        full_range_km=full,
        initial_range_km=initial,
        refill_range_km=refill,
        reserve_km=reserve,
    )


def test_cumulative_distances_along_equator():
    distances = cumulative_distances(ROUTE)

    assert distances[0] == 0
    assert distances[-1] == pytest.approx(1000.8, abs=1)


def test_no_stops_when_range_covers_route():
    plan = plan_energy_stops(ROUTE, profile(initial=1200), always_find)

    assert plan.stops == []
    assert plan.warnings == []


def test_plans_stop_before_reserve_each_time():
    plan = plan_energy_stops(ROUTE, profile(), always_find)

    # 400 km range, 50 km reserve → stop every 350 km.
    assert [round(stop.distance_from_start_km) for stop in plan.stops] == [
        350,
        700,
    ]
    assert all(stop.station is not None for stop in plan.stops)
    assert plan.stops[0].distance_from_route_km == pytest.approx(1.1, abs=0.1)


def test_uses_nearest_station_to_the_route():
    def find(latitude, longitude):
        return [
            EnergyStation("far", "Far", latitude, longitude + 0.05),
            EnergyStation("near", "Near", latitude, longitude + 0.01),
        ]

    plan = plan_energy_stops(ROUTE, profile(initial=600), find)

    assert plan.stops[0].station.name == "Near"


def test_moves_back_along_route_when_no_station_nearby():
    calls = []

    def find(latitude, longitude):
        calls.append(longitude)
        # Only the second attempt (20 km earlier) finds a station.
        return [station_at(latitude, longitude)] if len(calls) == 2 else []

    plan = plan_energy_stops(ROUTE, profile(initial=600), find)

    assert len(calls) >= 2
    assert round(plan.stops[0].distance_from_start_km) == 530


def test_warns_when_no_station_is_found():
    plan = plan_energy_stops(
        ROUTE,
        profile(initial=600, refill=600),
        lambda *_: [],
    )

    assert len(plan.stops) == 1
    assert plan.stops[0].station is None
    assert plan.warnings == ["No station found near km 550"]


def test_low_starting_level_plans_stop_at_start():
    plan = plan_energy_stops(ROUTE, profile(initial=30), always_find)

    assert plan.stops[0].distance_from_start_km == 0


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
