from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pytest

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.base import Base
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


def test_create_vehicle_saves_ev_fields(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        token = create_access_token(user.id)

        response = client.post(
            "/vehicles/",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "name": "My EV",
                "vehicle_type": "car",
                "fuel_type": "electric",
                "battery_capacity": 75,
                "energy_consumption": 18,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["name"] == "My EV"
        assert data["fuel_type"] == "electric"
        assert data["battery_capacity"] == 75
        assert data["energy_consumption"] == 18

        saved_vehicle = db.query(Vehicle).first()

        assert saved_vehicle is not None
        assert saved_vehicle.battery_capacity == 75
        assert saved_vehicle.energy_consumption == 18

    finally:
        db.close()


def test_get_vehicle_returns_ev_fields(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My EV",
            vehicle_type="car",
            fuel_type="electric",
            battery_capacity=80,
            energy_consumption=20,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        token = create_access_token(user.id)

        response = client.get(
            f"/vehicles/{vehicle.id}",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["battery_capacity"] == 80
        assert data["energy_consumption"] == 20

    finally:
        db.close()


def test_update_vehicle_saves_ev_fields(client):
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

        response = client.put(
            f"/vehicles/{vehicle.id}",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "name": "My EV",
                "vehicle_type": "car",
                "fuel_type": "electric",
                "battery_capacity": 75,
                "energy_consumption": 18,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["fuel_type"] == "electric"
        assert data["battery_capacity"] == 75
        assert data["energy_consumption"] == 18

        db.refresh(vehicle)

        assert vehicle.battery_capacity == 75
        assert vehicle.energy_consumption == 18

    finally:
        db.close()


def test_user_cannot_access_another_users_vehicle(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        vehicle = Vehicle(
            user_id=owner.id,
            name="Owner's EV",
            vehicle_type="car",
            fuel_type="electric",
            battery_capacity=75,
            energy_consumption=18,
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

        response = client.get(
            f"/vehicles/{vehicle.id}",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404

    finally:
        db.close()


def test_get_vehicle_fuel_range(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6,
            tank_capacity=60,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        token = create_access_token(user.id)

        response = client.get(
            f"/vehicles/{vehicle.id}/fuel-range",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["vehicle_id"] == vehicle.id
        assert data["fuel_available"] == 60
        assert data["fuel_consumption"] == 6
        assert data["estimated_range_km"] == 1000

    finally:
        db.close()


def test_get_vehicle_fuel_range_rejects_vehicle_without_tank_capacity(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6,
            tank_capacity=None,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        token = create_access_token(user.id)

        response = client.get(
            f"/vehicles/{vehicle.id}/fuel-range",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == (
            "Vehicle does not have tank capacity data"
        )

    finally:
        db.close()


def test_get_vehicle_fuel_range_rejects_vehicle_without_fuel_consumption(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=None,
            tank_capacity=60,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        token = create_access_token(user.id)

        response = client.get(
            f"/vehicles/{vehicle.id}/fuel-range",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == (
            "Vehicle does not have fuel consumption data"
        )

    finally:
        db.close()


def test_get_vehicle_fuel_range_cannot_access_another_users_vehicle(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)
        
        other_user = User(
            email="other@example.com",
            password_hash=hash_password("password123"),
            first_name="Other",
            last_name="User",
        )
        
        db.add(other_user)
        db.commit()
        db.refresh(other_user)

        vehicle = Vehicle(
            user_id=other_user.id,
            name="Other Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6,
            tank_capacity=60,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        token = create_access_token(user.id)

        response = client.get(
            f"/vehicles/{vehicle.id}/fuel-range",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Vehicle not found"

    finally:
        db.close()