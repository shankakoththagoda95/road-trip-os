from datetime import datetime, timedelta

import pytest

from app.core.security import create_access_token
from app.models.trip import Trip


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


@pytest.fixture
def trip(db, test_user):
    trip = Trip(
        user_id=test_user.id,
        name="Energy",
        start_location="Oslo",
        destination="Bergen",
        trip_type="one_way",
        departure_at=datetime.now() + timedelta(days=3),
        travelers=1,
        duration_days=2,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def test_fuel_can_be_read_back(client, auth_headers, trip):
    assert client.get(f"/trips/{trip.id}/fuel/", headers=auth_headers).status_code == 404

    client.post(
        f"/trips/{trip.id}/fuel/",
        headers=auth_headers,
        json={"starting_fuel": 45, "current_fuel": 45, "fuel_used": 0, "fuel_cost": 0},
    )
    response = client.get(f"/trips/{trip.id}/fuel/", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["starting_fuel"] == 45


def test_battery_can_be_read_back(client, auth_headers, trip):
    assert client.get(f"/trips/{trip.id}/ev/", headers=auth_headers).status_code == 404

    client.post(
        f"/trips/{trip.id}/ev/",
        headers=auth_headers,
        json={"starting_battery_percentage": 80},
    )
    response = client.get(f"/trips/{trip.id}/ev/", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["starting_battery_percentage"] == 80


def test_other_users_cannot_read_energy(client, trip):
    response = client.get(f"/trips/{trip.id}/fuel/", headers={"Authorization": "Bearer nope"})

    assert response.status_code == 401
