from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.base import Base
from app.models.trip import Trip
from app.models.trip_ev import TripEV
from app.models.user import User
from app.models.vehicle import Vehicle


TEST_DATABASE_URL = "sqlite:///:memory:"


engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    previous_override = app.dependency_overrides.get(get_db)

    app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(app)
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override


def create_test_user(
    db,
    email="test@example.com",
):
    user = User(
        email=email,
        password_hash=hash_password("password123"),
        first_name="Test",
        last_name="User",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def create_test_trip(db, user):
    vehicle = Vehicle(
        user_id=user.id,
        name="Test EV",
        vehicle_type="car",
        fuel_type="electric",
        battery_capacity=75.0,
        energy_consumption=20.0,
    )

    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    trip = Trip(
        user_id=user.id,
        vehicle_id=vehicle.id,
        name="Stockholm to Oslo",
        start_location="Stockholm",
        destination="Oslo",
        trip_type="one_way",
        departure_at=datetime.now() + timedelta(days=7),
        travelers=2,
        duration_days=2,
    )

    db.add(trip)
    db.commit()
    db.refresh(trip)

    return trip


def test_create_trip_ev(client):
    db = TestingSessionLocal()

    user = create_test_user(db)
    trip = create_test_trip(db, user)

    token = create_access_token(user.id)

    db.close()

    response = client.post(
        f"/trips/{trip.id}/ev/",
        json={
            "starting_battery_percentage": 80,
        },
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["trip_id"] == trip.id
    assert data["starting_battery_percentage"] == 80
    assert data["current_battery_percentage"] == 80

    db = TestingSessionLocal()

    saved_ev = db.scalar(
        select(TripEV).where(
            TripEV.trip_id == trip.id,
        )
    )

    assert saved_ev is not None
    assert saved_ev.starting_battery_percentage == 80
    assert saved_ev.current_battery_percentage == 80

    db.close()


def test_user_cannot_create_ev_for_another_users_trip(client):
    db = TestingSessionLocal()

    owner = create_test_user(
        db,
        "owner@example.com",
    )

    other_user = create_test_user(
        db,
        "other@example.com",
    )

    trip = create_test_trip(db, owner)

    token = create_access_token(other_user.id)

    db.close()

    response = client.post(
        f"/trips/{trip.id}/ev/",
        json={
            "starting_battery_percentage": 80,
        },
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_create_ev_for_nonexistent_trip(client):
    db = TestingSessionLocal()

    user = create_test_user(db)
    token = create_access_token(user.id)

    db.close()

    response = client.post(
        "/trips/9999/ev/",
        json={
            "starting_battery_percentage": 80,
        },
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_cannot_create_duplicate_ev_for_trip(client):
    db = TestingSessionLocal()

    user = create_test_user(db)
    trip = create_test_trip(db, user)

    existing_ev = TripEV(
        trip_id=trip.id,
        starting_battery_percentage=90,
        current_battery_percentage=90,
    )

    db.add(existing_ev)
    db.commit()

    trip_id = trip.id
    token = create_access_token(user.id)
    
    db.close()
    
    response = client.post(
        f"/trips/{trip_id}/ev/",
        json={
            "starting_battery_percentage": 80,
        },
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "EV data already exists for this trip"


@pytest.mark.parametrize(
    "battery_percentage",
    [-1, 101],
)
def test_invalid_battery_percentage_is_rejected(
    client,
    battery_percentage,
):
    db = TestingSessionLocal()

    user = create_test_user(db)
    trip = create_test_trip(db, user)

    token = create_access_token(user.id)

    db.close()

    response = client.post(
        f"/trips/{trip.id}/ev/",
        json={
            "starting_battery_percentage": battery_percentage,
        },
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 422