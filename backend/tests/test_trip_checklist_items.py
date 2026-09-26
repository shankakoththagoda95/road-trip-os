from datetime import datetime, timedelta

import pytest
from sqlalchemy import select, text

from app.core.security import create_access_token
from app.models.trip import Trip
from app.models.trip_checklist_item import TripChecklistItem
from app.models.user import User


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


@pytest.fixture
def trip(db, test_user):
    trip = Trip(
        user_id=test_user.id,
        name="Alps loop",
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


def url(trip_id, suffix=""):
    return f"/trips/{trip_id}/checklist/{suffix}"


def test_bulk_create_and_list_orders_generated_before_personal(
    client, auth_headers, trip
):
    response = client.post(
        url(trip.id, "bulk"),
        headers=auth_headers,
        json={
            "items": [
                {"name": "Sunglasses", "personal": True},
                {
                    "name": "Austrian vignette",
                    "description": "Required on motorways.",
                    "category": "payments",
                    "required": True,
                    "personal": False,
                },
                {"name": "  Phone charger  "},
            ]
        },
    )

    assert response.status_code == 201
    assert [item["position"] for item in response.json()] == [1, 2, 3]

    items = client.get(url(trip.id), headers=auth_headers).json()

    assert [item["name"] for item in items] == [
        "Austrian vignette",
        "Sunglasses",
        "Phone charger",
    ]
    assert items[0]["required"] is True
    assert items[0]["category"] == "payments"
    assert all(item["checked"] is False for item in items)


def test_add_tick_rename_and_delete_item(client, auth_headers, trip):
    created = client.post(
        url(trip.id), headers=auth_headers, json={"name": "Snacks"}
    )
    assert created.status_code == 201
    item_id = created.json()["id"]
    assert created.json()["personal"] is True

    ticked = client.patch(
        url(trip.id, str(item_id)), headers=auth_headers, json={"checked": True}
    )
    assert ticked.json()["checked"] is True
    assert ticked.json()["name"] == "Snacks"

    renamed = client.patch(
        url(trip.id, str(item_id)), headers=auth_headers, json={"name": "Road snacks"}
    )
    assert renamed.json() == {**ticked.json(), "name": "Road snacks"}

    deleted = client.delete(url(trip.id, str(item_id)), headers=auth_headers)
    assert deleted.status_code == 204
    assert client.get(url(trip.id), headers=auth_headers).json() == []


def test_new_items_go_after_existing_ones(client, auth_headers, trip):
    client.post(url(trip.id, "bulk"), headers=auth_headers, json={"items": [{"name": "A"}, {"name": "B"}]})
    later = client.post(url(trip.id), headers=auth_headers, json={"name": "C"})

    assert later.json()["position"] == 3


@pytest.mark.parametrize(
    "body",
    [{"name": ""}, {"name": "   "}, {"name": "x" * 201}, {"name": "Map", "category": "snacks"}],
)
def test_invalid_items_are_rejected(client, auth_headers, trip, body):
    response = client.post(url(trip.id), headers=auth_headers, json=body)

    assert response.status_code == 422


def test_other_users_trips_are_hidden(client, db, trip):
    stranger = User(
        email="stranger@example.com",
        password_hash="x",
        first_name="Stranger",
        last_name="Danger",
        email_verified_at=datetime.now(),
    )
    db.add(stranger)
    db.commit()
    headers = {"Authorization": f"Bearer {create_access_token(stranger.id)}"}

    assert client.get(url(trip.id), headers=headers).status_code == 404
    assert (
        client.post(url(trip.id), headers=headers, json={"name": "Hack"}).status_code
        == 404
    )


def test_item_from_another_trip_is_not_found(client, auth_headers, db, trip, test_user):
    other = Trip(
        user_id=test_user.id,
        name="Other",
        start_location="Oslo",
        destination="Bergen",
        trip_type="one_way",
        departure_at=datetime.now() + timedelta(days=9),
        travelers=1,
        duration_days=2,
    )
    db.add(other)
    db.commit()
    item_id = client.post(url(other.id), headers=auth_headers, json={"name": "Map"}).json()["id"]

    response = client.patch(
        url(trip.id, str(item_id)), headers=auth_headers, json={"checked": True}
    )

    assert response.status_code == 404


def test_deleting_trip_removes_its_checklist(client, auth_headers, db, trip):
    db.execute(text("PRAGMA foreign_keys=ON"))
    client.post(url(trip.id), headers=auth_headers, json={"name": "Map"})

    response = client.delete(f"/trips/{trip.id}", headers=auth_headers)
    db.execute(text("PRAGMA foreign_keys=OFF"))

    assert response.status_code == 200
    assert db.scalars(select(TripChecklistItem)).all() == []
