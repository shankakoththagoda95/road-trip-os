from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.base import Base
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.trip import Trip


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


def create_test_user(db):
    user = User(
        email="test@example.com",
        password_hash=hash_password("password123"),
        first_name="Test",
        last_name="User",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user


def test_create_trip_with_vehicle(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6.5,
            tank_capacity=55,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        token = create_access_token(user.id)

        response = client.post(
            "/trips/",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "name": "Stockholm to Oslo",
                "start_location": "Stockholm",
                "destination": "Oslo",
                "trip_type": "one_way",
                "departure_at": (
                    datetime.now() + timedelta(days=1)
                ).isoformat(),
                "travelers": 2,
                "duration_days": 2,
                "vehicle_id": vehicle.id,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["name"] == "Stockholm to Oslo"
        assert data["vehicle_id"] == vehicle.id

    finally:
        db.close()


def test_create_trip_cannot_use_another_users_vehicle(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        vehicle = Vehicle(
            user_id=owner.id,
            name="Owner's Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6.5,
            tank_capacity=55,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        other_user = User(
            email="other@example.com",
            password_hash=hash_password("password123"),
            first_name="Other",
            last_name="User",
        )

        db.add(other_user)
        db.commit()
        db.refresh(other_user)

        token = create_access_token(other_user.id)

        response = client.post(
            "/trips/",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "name": "Stockholm to Oslo",
                "start_location": "Stockholm",
                "destination": "Oslo",
                "trip_type": "one_way",
                "departure_at": (
                    datetime.now() + timedelta(days=1)
                ).isoformat(),
                "travelers": 2,
                "duration_days": 2,
                "vehicle_id": vehicle.id,
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Vehicle not found"

    finally:
        db.close()


def test_get_trip_returns_vehicle_id(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6.5,
            tank_capacity=55,
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
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=2,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        response = client.get(
            f"/trips/{trip.id}",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["id"] == trip.id
        assert data["name"] == "Stockholm to Oslo"
        assert data["vehicle_id"] == vehicle.id

    finally:
        db.close()


def test_update_trip_changes_vehicle(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        first_vehicle = Vehicle(
            user_id=user.id,
            name="First Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6.5,
            tank_capacity=55,
        )

        second_vehicle = Vehicle(
            user_id=user.id,
            name="Second Car",
            vehicle_type="diesel",
            fuel_type="diesel",
            fuel_consumption=5.5,
            tank_capacity=60,
        )

        db.add_all([first_vehicle, second_vehicle])
        db.commit()
        db.refresh(first_vehicle)
        db.refresh(second_vehicle)

        trip = Trip(
            user_id=user.id,
            vehicle_id=first_vehicle.id,
            name="Stockholm to Oslo",
            start_location="Stockholm",
            destination="Oslo",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=2,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        response = client.put(
            f"/trips/{trip.id}",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "name": "Stockholm to Oslo",
                "start_location": "Stockholm",
                "destination": "Oslo",
                "trip_type": "one_way",
                "departure_at": (
                    datetime.now() + timedelta(days=1)
                ).isoformat(),
                "travelers": 2,
                "duration_days": 2,
                "vehicle_id": second_vehicle.id,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["vehicle_id"] == second_vehicle.id

        db.refresh(trip)

        assert trip.vehicle_id == second_vehicle.id

    finally:
        db.close()


def test_update_trip_cannot_use_another_users_vehicle(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        owner_vehicle = Vehicle(
            user_id=owner.id,
            name="Owner's Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6.5,
            tank_capacity=55,
        )

        db.add(owner_vehicle)
        db.commit()
        db.refresh(owner_vehicle)

        trip = Trip(
            user_id=owner.id,
            vehicle_id=owner_vehicle.id,
            name="Stockholm to Oslo",
            start_location="Stockholm",
            destination="Oslo",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=2,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        other_user = User(
            email="other@example.com",
            password_hash=hash_password("password123"),
            first_name="Other",
            last_name="User",
        )

        db.add(other_user)
        db.commit()
        db.refresh(other_user)

        other_vehicle = Vehicle(
            user_id=other_user.id,
            name="Other's Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=7,
            tank_capacity=50,
        )

        db.add(other_vehicle)
        db.commit()
        db.refresh(other_vehicle)

        token = create_access_token(owner.id)

        response = client.put(
            f"/trips/{trip.id}",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "name": "Stockholm to Oslo",
                "start_location": "Stockholm",
                "destination": "Oslo",
                "trip_type": "one_way",
                "departure_at": (
                    datetime.now() + timedelta(days=1)
                ).isoformat(),
                "travelers": 2,
                "duration_days": 2,
                "vehicle_id": other_vehicle.id,
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Vehicle not found"

    finally:
        db.close()