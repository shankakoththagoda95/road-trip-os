from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import text

from app.core.security import create_access_token
from app.models.itinerary import Itinerary
from app.models.itinerary_day import ItineraryDay
from app.models.trip import Trip
from app.models.trip_budget import TripBudget
from app.models.trip_destination import TripDestination
from app.models.trip_fuel import TripFuel
from app.models.user import User


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


def make_trip(db, user_id, **overrides):
    values = {
        "user_id": user_id,
        "name": "Stockholm to Oslo",
        "start_location": "Stockholm",
        "destination": "Oslo",
        "trip_type": "one_way",
        "departure_at": datetime.now() + timedelta(days=3),
        "travelers": 2,
        "duration_days": 4,
    }
    trip = Trip(**{**values, **overrides})
    db.add(trip)
    db.commit()
    db.refresh(trip)

    return trip


# --- Delete ---


@pytest.fixture
def enforce_foreign_keys(db):
    # SQLite ignores foreign keys unless asked; Postgres always enforces them.
    db.execute(text("PRAGMA foreign_keys=ON"))
    yield
    db.execute(text("PRAGMA foreign_keys=OFF"))


def test_delete_trip_removes_related_rows(
    client,
    auth_headers,
    test_user,
    db,
    enforce_foreign_keys,
):
    trip = make_trip(db, test_user.id)
    itinerary = Itinerary(trip_id=trip.id)
    db.add(itinerary)
    db.flush()
    db.add_all(
        [
            ItineraryDay(
                itinerary_id=itinerary.id,
                day_number=1,
                total_distance_meters=1000,
                total_duration_seconds=60,
                distance_status="within_limit",
                driving_time_status="within_limit",
            ),
            TripDestination(
                trip_id=trip.id,
                location="Karlstad",
                stop_order=1,
                latitude=59.38,
                longitude=13.5,
            ),
            TripBudget(trip_id=trip.id, currency="EUR"),
            TripFuel(
                trip_id=trip.id,
                starting_fuel=50,
                current_fuel=50,
                fuel_used=0,
                fuel_cost=0,
            ),
        ]
    )
    db.commit()
    trip_id = trip.id

    response = client.delete(f"/trips/{trip_id}", headers=auth_headers)

    assert response.status_code == 200
    db.expire_all()
    assert db.get(Trip, trip_id) is None
    assert db.query(TripDestination).count() == 0
    assert db.query(ItineraryDay).count() == 0
    assert db.query(Itinerary).count() == 0
    assert db.query(TripBudget).count() == 0
    assert db.query(TripFuel).count() == 0


# --- Budget ---

BUDGET = {
    "currency": "SEK",
    "estimated_fuel_cost": 800,
    "estimated_food_cost": 1200,
}


def test_get_budget_404_when_missing(client, auth_headers, test_user, db):
    trip = make_trip(db, test_user.id)

    response = client.get(f"/trips/{trip.id}/budget/", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["detail"] == "Budget not found"


def test_get_and_update_budget(client, auth_headers, test_user, db):
    trip = make_trip(db, test_user.id)
    client.post(f"/trips/{trip.id}/budget/", json=BUDGET, headers=auth_headers)

    response = client.get(f"/trips/{trip.id}/budget/", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["currency"] == "SEK"
    assert response.json()["estimated_total"] == 2000

    updated = client.put(
        f"/trips/{trip.id}/budget/",
        json={**BUDGET, "currency": "EUR", "estimated_toll_cost": 50},
        headers=auth_headers,
    )

    assert updated.status_code == 200
    assert updated.json()["currency"] == "EUR"
    assert updated.json()["estimated_total"] == 2050
    assert updated.json()["remaining_budget"] == 2050


def test_budget_of_another_users_trip_is_hidden(client, auth_headers, db):
    other = User(
        email="other@example.org",
        password_hash="x",
        first_name="O",
        last_name="U",
    )
    db.add(other)
    db.commit()
    trip = make_trip(db, other.id)
    db.add(TripBudget(trip_id=trip.id, currency="EUR"))
    db.commit()

    assert (
        client.get(f"/trips/{trip.id}/budget/", headers=auth_headers).status_code
        == 404
    )
    assert (
        client.put(
            f"/trips/{trip.id}/budget/",
            json=BUDGET,
            headers=auth_headers,
        ).status_code
        == 404
    )


# --- Route ---

COORDINATES = {"Stockholm": (59.33, 18.07), "Oslo": (59.91, 10.75)}


def route_with_legs(*hours):
    return {
        "distance_meters": 530_000 * len(hours),
        "duration_seconds": sum(hours) * 3600,
        "legs": [
            {"distance_meters": 530_000, "duration_seconds": h * 3600}
            for h in hours
        ],
        "geometry": {
            "type": "LineString",
            "coordinates": [[18.07, 59.33], [10.75, 59.91]],
        },
    }


def get_route(client, auth_headers, trip, route):
    with (
        patch(
            "app.services.trip_route.resolve_location",
            side_effect=lambda location: COORDINATES[location],
        ),
        patch("app.services.trip_route.calculate_trip_route", return_value=route),
    ):
        return client.get(f"/trips/{trip.id}/route", headers=auth_headers)


def test_route_returns_markers_and_scheduled_days(
    client,
    auth_headers,
    test_user,
    db,
):
    trip = make_trip(
        db,
        test_user.id,
        trip_type="round_trip",
        max_driving_hours_per_day=8,
    )

    response = get_route(client, auth_headers, trip, route_with_legs(6, 6))

    assert response.status_code == 200

    data = response.json()

    assert [point["kind"] for point in data["points"]] == ["start", "destination"]
    assert (data["points"][0]["latitude"], data["points"][0]["longitude"]) == (
        59.33,
        18.07,
    )
    # Out on day 1, home on the last day (4).
    assert [day["day_number"] for day in data["days"]] == [1, 4]
    assert data["problems"] == []


def test_route_reports_legs_over_the_daily_limit(
    client,
    auth_headers,
    test_user,
    db,
):
    trip = make_trip(db, test_user.id, max_driving_hours_per_day=5)

    response = get_route(client, auth_headers, trip, route_with_legs(6))

    assert response.status_code == 200
    assert response.json()["days"] == []
    assert "Stockholm → Oslo takes 6 h" in response.json()["problems"][0]


def test_external_service_failure_returns_502(client, auth_headers, test_user, db):
    import httpx

    trip = make_trip(db, test_user.id)

    with patch(
        "app.services.trip_route.resolve_location",
        side_effect=httpx.ConnectError("routing server down"),
    ):
        response = client.get(f"/trips/{trip.id}/route", headers=auth_headers)

    assert response.status_code == 502
    assert "unavailable" in response.json()["detail"]


def test_delete_vehicle_used_by_a_trip_keeps_the_trip(
    client,
    auth_headers,
    test_user,
    db,
    enforce_foreign_keys,
):
    from app.models.vehicle import Vehicle

    vehicle = Vehicle(
        user_id=test_user.id,
        name="Family Volvo",
        vehicle_type="car",
        fuel_type="diesel",
        fuel_consumption=6.0,
        tank_capacity=60.0,
    )
    db.add(vehicle)
    db.commit()
    trip = make_trip(db, test_user.id, vehicle_id=vehicle.id)
    vehicle_id, trip_id = vehicle.id, trip.id

    response = client.delete(f"/vehicles/{vehicle_id}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["trips_updated"] == 1
    db.expire_all()
    assert db.get(Vehicle, vehicle_id) is None
    assert db.get(Trip, trip_id).vehicle_id is None
