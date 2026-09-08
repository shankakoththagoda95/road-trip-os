from datetime import datetime

from app.core.security import create_access_token
from app.models.trip import Trip
from app.models.user import User


def create_test_trip(db, user_id):
    trip = Trip(
        user_id=user_id,
        vehicle_id=None,
        name="Budget Test Trip",
        start_location="Stockholm",
        destination="Gothenburg",
        trip_type="road_trip",
        departure_at=datetime(2026, 9, 10, 9, 0),
        travelers=2,
        duration_days=2,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def test_create_trip_budget(client, test_user, db):
    trip = create_test_trip(db, test_user.id)

    login_response = client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": "password123",
        },
    )

    token = login_response.json()["access_token"]

    response = client.post(
        f"/trips/{trip.id}/budget/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json={
            "currency": "EUR",
            "estimated_fuel_cost": 100,
            "estimated_ev_charging_cost": 50,
            "estimated_toll_cost": 20,
            "estimated_food_cost": 200,
            "estimated_parking_cost": 30,
            "estimated_other_cost": 10,
            "actual_fuel_cost": 80,
            "actual_ev_charging_cost": 40,
            "actual_toll_cost": 20,
            "actual_food_cost": 150,
            "actual_parking_cost": 20,
            "actual_other_cost": 5,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["trip_id"] == trip.id
    assert data["currency"] == "EUR"

    assert data["estimated_total"] == 410
    assert data["actual_total"] == 315
    assert data["remaining_budget"] == 95


def test_create_trip_budget_uses_defaults(client, test_user, db):
    trip = create_test_trip(db, test_user.id)

    login_response = client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": "password123",
        },
    )

    token = login_response.json()["access_token"]

    response = client.post(
        f"/trips/{trip.id}/budget/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json={},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["currency"] == "EUR"
    assert data["estimated_total"] == 0
    assert data["actual_total"] == 0
    assert data["remaining_budget"] == 0


def test_create_trip_budget_duplicate(client, test_user, db):
    trip = create_test_trip(db, test_user.id)

    login_response = client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": "password123",
        },
    )

    token = login_response.json()["access_token"]

    payload = {
        "currency": "EUR",
        "estimated_food_cost": 500,
    }

    first_response = client.post(
        f"/trips/{trip.id}/budget/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json=payload,
    )

    assert first_response.status_code == 200

    second_response = client.post(
        f"/trips/{trip.id}/budget/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json=payload,
    )

    assert second_response.status_code == 409
    assert second_response.json()["detail"] == (
        "Budget already exists for this trip"
    )


def test_create_trip_budget_trip_not_found(client, test_user):
    token = create_access_token(test_user.id)

    response = client.post(
        "/trips/99999/budget/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json={},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_create_trip_budget_cannot_access_other_users_trip(
    client,
    test_user,
    db,
):
    other_user = User(
        email="other@example.com",
        password_hash="not-used",
        first_name="Other",
        last_name="User",
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)

    trip = create_test_trip(db, other_user.id)
    token = create_access_token(test_user.id)

    response = client.post(
        f"/trips/{trip.id}/budget/",
        headers={
            "Authorization": f"Bearer {token}",
        },
        json={
            "estimated_food_cost": 100,
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"