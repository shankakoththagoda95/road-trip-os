from datetime import datetime, timedelta

import pytest
from sqlalchemy import select, text

from app.core.security import create_access_token, hash_password
from app.models.trip import Trip
from app.models.trip_meal import TripMeal
from app.models.user import User


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


@pytest.fixture
def trip(db, test_user):
    trip = Trip(
        user_id=test_user.id,
        name="Meals",
        start_location="Munich",
        destination="Salzburg",
        trip_type="one_way",
        departure_at=datetime.now() + timedelta(days=5),
        travelers=2,
        duration_days=3,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def url(trip_id):
    return f"/trips/{trip_id}/checklist/meals"


def test_empty_plan_has_three_meals_a_day_and_snacks(client, auth_headers, trip):
    plan = client.get(url(trip.id), headers=auth_headers).json()

    assert [day["day_number"] for day in plan["days"]] == [1, 2, 3]
    assert plan["days"][0]["breakfast"] == {
        "day_number": 1,
        "meal": "breakfast",
        "kind": "fast_food",
        "description": None,
    }
    assert plan["snacks"]["day_number"] is None
    assert plan["snacks"]["kind"] == "fast_food"


def test_plan_home_prepared_meals_and_snacks(client, auth_headers, trip):
    lunch = client.put(
        url(trip.id),
        headers=auth_headers,
        json={"day_number": 2, "meal": "lunch", "kind": "home_prep", "description": "  Pasta salad "},
    )
    snacks = client.put(
        url(trip.id),
        headers=auth_headers,
        json={"meal": "snacks", "kind": "home_prep", "description": "Nuts, fruit"},
    )

    assert lunch.status_code == 200
    assert lunch.json()["description"] == "Pasta salad"
    assert snacks.json()["day_number"] is None

    plan = client.get(url(trip.id), headers=auth_headers).json()
    assert plan["days"][1]["lunch"]["kind"] == "home_prep"
    assert plan["days"][1]["lunch"]["description"] == "Pasta salad"
    assert plan["days"][1]["dinner"]["kind"] == "fast_food"
    assert plan["snacks"]["description"] == "Nuts, fruit"


def test_updating_a_meal_replaces_it(client, auth_headers, trip, db):
    body = {"day_number": 1, "meal": "dinner", "kind": "home_prep", "description": "Soup"}
    client.put(url(trip.id), headers=auth_headers, json=body)
    # Back to fast food: the description is dropped.
    back = client.put(url(trip.id), headers=auth_headers, json={**body, "kind": "fast_food"})

    assert back.json()["description"] is None
    assert len(db.scalars(select(TripMeal)).all()) == 1


@pytest.mark.parametrize(
    "body",
    [
        {"meal": "lunch", "kind": "home_prep"},
        {"day_number": 1, "meal": "snacks", "kind": "fast_food"},
        {"day_number": 4, "meal": "lunch", "kind": "fast_food"},
        {"day_number": 0, "meal": "lunch", "kind": "fast_food"},
        {"day_number": 1, "meal": "brunch", "kind": "fast_food"},
        {"day_number": 1, "meal": "lunch", "kind": "restaurant"},
        {"day_number": 1, "meal": "lunch", "kind": "home_prep", "description": "x" * 501},
    ],
)
def test_invalid_meals_are_rejected(client, auth_headers, trip, body):
    response = client.put(url(trip.id), headers=auth_headers, json=body)

    assert response.status_code == 422


def test_other_users_trips_are_hidden(client, db, trip):
    stranger = User(
        email="stranger@example.com",
        password_hash=hash_password("x"),
        first_name="S",
        last_name="T",
        email_verified_at=datetime.now(),
    )
    db.add(stranger)
    db.commit()
    headers = {"Authorization": f"Bearer {create_access_token(stranger.id)}"}

    assert client.get(url(trip.id), headers=headers).status_code == 404
    assert (
        client.put(
            url(trip.id), headers=headers, json={"meal": "snacks", "kind": "fast_food"}
        ).status_code
        == 404
    )


def test_deleting_the_trip_removes_its_meals(client, auth_headers, trip, db):
    db.execute(text("PRAGMA foreign_keys=ON"))
    client.put(url(trip.id), headers=auth_headers, json={"meal": "snacks", "kind": "fast_food"})

    response = client.delete(f"/trips/{trip.id}", headers=auth_headers)
    db.execute(text("PRAGMA foreign_keys=OFF"))

    assert response.status_code == 200
    assert db.scalars(select(TripMeal)).all() == []
