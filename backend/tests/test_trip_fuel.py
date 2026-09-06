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
from app.models.trip_fuel import TripFuel
from app.models.user import User
from app.models.trip_location import TripLocation
from app.models.user_settings import UserSettings
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


def create_test_user(db, email="test@example.com"):
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
        name="Test Car",
        vehicle_type="car",
        fuel_type="petrol",
        fuel_consumption=6.0,
        tank_capacity=60.0,
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


def test_create_trip_fuel(client):
    db = TestingSessionLocal()
    user = create_test_user(db)
    trip = create_test_trip(db, user)
    token = create_access_token(user.id)
    db.close()

    response = client.post(
        f"/trips/{trip.id}/fuel/",
        json={
            "starting_fuel": 50,
            "current_fuel": 40,
            "fuel_used": 10,
            "fuel_cost": 25,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["trip_id"] == trip.id
    assert data["starting_fuel"] == 50
    assert data["current_fuel"] == 40
    assert data["fuel_used"] == 10
    assert data["fuel_cost"] == 25

    db = TestingSessionLocal()
    saved_fuel = db.scalar(
        select(TripFuel).where(TripFuel.trip_id == trip.id)
    )

    assert saved_fuel is not None
    assert saved_fuel.current_fuel == 40
    assert saved_fuel.fuel_used == 10
    assert saved_fuel.fuel_cost == 25
    db.close()


def test_user_cannot_create_fuel_for_another_users_trip(client):
    db = TestingSessionLocal()

    owner = create_test_user(db, "owner@example.com")
    other_user = create_test_user(db, "other@example.com")

    trip = create_test_trip(db, owner)

    token = create_access_token(other_user.id)
    db.close()

    response = client.post(
        f"/trips/{trip.id}/fuel/",
        json={
            "starting_fuel": 50,
            "current_fuel": 40,
            "fuel_used": 10,
            "fuel_cost": 25,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_create_fuel_for_nonexistent_trip(client):
    db = TestingSessionLocal()
    user = create_test_user(db)
    token = create_access_token(user.id)
    db.close()

    response = client.post(
        "/trips/9999/fuel/",
        json={
            "starting_fuel": 50,
            "current_fuel": 40,
            "fuel_used": 10,
            "fuel_cost": 25,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Trip not found"


def test_cannot_create_duplicate_fuel_for_trip(client):
    db = TestingSessionLocal()
    user = create_test_user(db)
    trip = create_test_trip(db, user)

    existing_fuel = TripFuel(
        trip_id=trip.id,
        starting_fuel=50,
        current_fuel=40,
        fuel_used=10,
        fuel_cost=25,
    )

    db.add(existing_fuel)
    db.commit()
    
    trip_id = trip.id
    token = create_access_token(user.id)
    db.close()
    
    response = client.post(
        f"/trips/{trip_id}/fuel/",
        json={
            "starting_fuel": 60,
            "current_fuel": 50,
            "fuel_used": 10,
            "fuel_cost": 30,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Fuel data already exists for this trip"


@pytest.mark.parametrize(
    "field",
    [
        "starting_fuel",
        "current_fuel",
        "fuel_used",
        "fuel_cost",
    ],
)
def test_negative_fuel_values_are_rejected_by_api(client, field):
    db = TestingSessionLocal()
    user = create_test_user(db)
    trip = create_test_trip(db, user)
    token = create_access_token(user.id)
    db.close()

    fuel_data = {
        "starting_fuel": 50,
        "current_fuel": 40,
        "fuel_used": 10,
        "fuel_cost": 25,
    }

    fuel_data[field] = -1

    response = client.post(
        f"/trips/{trip.id}/fuel/",
        json=fuel_data,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 422


def test_fuel_status_uses_user_gps_threshold(client):
    db = TestingSessionLocal()

    user = create_test_user(
        db,
        "fuel-settings@example.com",
    )

    trip = create_test_trip(db, user)

    trip_fuel = TripFuel(
        trip_id=trip.id,
        starting_fuel=60,
        current_fuel=60,
        fuel_used=0,
        fuel_cost=0,
    )

    db.add(trip_fuel)

    db.add_all(
        [
            TripLocation(
                trip_id=trip.id,
                latitude=59.3293,
                longitude=18.0686,
                recorded_at=datetime.now(),
            ),
            TripLocation(
                trip_id=trip.id,
                latitude=59.3295,
                longitude=18.0688,
                recorded_at=datetime.now() + timedelta(seconds=1),
            ),
        ]
    )

    settings = UserSettings(
        user_id=user.id,
        gps_movement_threshold_meters=1000,
    )

    db.add(settings)
    db.commit()

    print(
        "TEST SETTINGS:",
        settings.gps_movement_threshold_meters,
    )

    trip_id = trip.id
    token = create_access_token(user.id)
    db.close()

    response = client.get(
        f"/trips/{trip_id}/fuel-status",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200

    data = response.json()

    assert data["trip_id"] == trip_id
    assert data["distance_traveled_km"] == 0
    assert data["fuel_remaining"] == 60


def test_record_location_updates_fuel(client):
    db = TestingSessionLocal()

    user = create_test_user(
        db,
        "automatic-fuel@example.com",
    )

    trip = create_test_trip(db, user)

    trip_fuel = TripFuel(
        trip_id=trip.id,
        starting_fuel=60,
        current_fuel=60,
        fuel_used=0,
        fuel_cost=0,
    )

    db.add(trip_fuel)

    db.commit()

    trip_id = trip.id
    token = create_access_token(user.id)

    db.close()

    first_response = client.post(
        f"/trips/{trip_id}/locations",
        json={
            "latitude": 59.3293,
            "longitude": 18.0686,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert first_response.status_code == 200

    second_response = client.post(
        f"/trips/{trip_id}/locations",
        json={
            "latitude": 59.3326,
            "longitude": 18.0649,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert second_response.status_code == 200

    db = TestingSessionLocal()

    updated_fuel = db.scalar(
        select(TripFuel).where(
            TripFuel.trip_id == trip_id,
        )
    )

    assert updated_fuel.current_fuel < 60
    assert updated_fuel.fuel_used > 0

    db.close()


def test_record_location_below_threshold_does_not_update_fuel(client):
    db = TestingSessionLocal()

    user = create_test_user(
        db,
        "below-threshold@example.com",
    )

    trip = create_test_trip(db, user)

    trip_fuel = TripFuel(
        trip_id=trip.id,
        starting_fuel=60,
        current_fuel=60,
        fuel_used=0,
        fuel_cost=0,
    )

    db.add(trip_fuel)
    db.commit()

    trip_id = trip.id
    token = create_access_token(user.id)

    db.close()

    first_response = client.post(
        f"/trips/{trip_id}/locations",
        json={
            "latitude": 59.3293,
            "longitude": 18.0686,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert first_response.status_code == 200

    second_response = client.post(
        f"/trips/{trip_id}/locations",
        json={
            "latitude": 59.32935,
            "longitude": 18.06865,
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert second_response.status_code == 200

    db = TestingSessionLocal()

    updated_fuel = db.scalar(
        select(TripFuel).where(
            TripFuel.trip_id == trip_id,
        )
    )

    assert updated_fuel.current_fuel == 60
    assert updated_fuel.fuel_used == 0

    db.close()