from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from datetime import datetime
from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.base import Base
from app.models.trip import Trip
from app.models.trip_ev import TripEV
from app.models.user import User
from app.models.vehicle import Vehicle
from unittest.mock import patch

def set_test_db_override():
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    return previous_override


def restore_db_override(previous_override):
    if previous_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_override


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


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user():
    db = TestingSessionLocal()
    try:
        return db.query(User).filter(User.email == "test@example.com").first()
    finally:
        db.close()


def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_get_ev_status():
    setup_database()

    previous_override = set_test_db_override()

    db = TestingSessionLocal()

    try:
        user = User(
            email="test@example.com",
            password_hash=hash_password("password123"),
            first_name="Test",
            last_name="User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        vehicle = Vehicle(
            user_id=user.id,
            name="Test EV",
            vehicle_type="car",
            fuel_type="electric",
            battery_capacity=60,
            energy_consumption=20,
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        trip = Trip(
            user_id=user.id,
            vehicle_id=vehicle.id,
            name="EV Test Trip",
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

        trip_ev = TripEV(
            trip_id=trip.id,
            starting_battery_percentage=80,
            current_battery_percentage=80,
        )
        db.add(trip_ev)
        db.commit()

        trip_id = trip.id
        token = create_access_token(user.id)

    finally:
        db.close()

    try:
        client = TestClient(app)

        response = client.get(
            f"/trips/{trip_id}/ev-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["trip_id"] == trip_id
        assert data["battery_percentage"] == 80
        assert data["available_range_km"] == 240
        assert data["usable_range_km"] == 192
        assert data["route_distance_km"] > 0
        assert data["needs_charging"] is True
        assert data["range_shortfall_km"] > 0

    finally:
        restore_db_override(previous_override)


def test_get_ev_status_trip_not_found():
    setup_database()

    previous_override = set_test_db_override()

    try:
        client = TestClient(app)
        token = create_access_token(999)

        response = client.get(
            "/trips/999/ev-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 401
        assert response.json()["detail"] == "User not found"

    finally:
        restore_db_override(previous_override)


def test_get_ev_status_without_vehicle():
    setup_database()

    previous_override = set_test_db_override()

    db = TestingSessionLocal()

    try:
        user = User(
            email="test@example.com",
            password_hash=hash_password("password123"),
            first_name="Test",
            last_name="User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        trip = Trip(
            user_id=user.id,
            vehicle_id=None,
            name="No Vehicle Trip",
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

        trip_id = trip.id
        token = create_access_token(user.id)

    finally:
        db.close()

    try:
        client = TestClient(app)

        response = client.get(
            f"/trips/{trip_id}/ev-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Trip does not have a vehicle"

    finally:
        restore_db_override(previous_override)


def test_get_ev_status_without_ev_data():
    setup_database()

    previous_override = set_test_db_override()

    db = TestingSessionLocal()

    try:
        user = User(
            email="test@example.com",
            password_hash=hash_password("password123"),
            first_name="Test",
            last_name="User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        vehicle = Vehicle(
            user_id=user.id,
            name="Test EV",
            vehicle_type="car",
            fuel_type="electric",
            battery_capacity=60,
            energy_consumption=20,
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        trip = Trip(
            user_id=user.id,
            vehicle_id=vehicle.id,
            name="Missing EV Data Trip",
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

        trip_id = trip.id
        token = create_access_token(user.id)

    finally:
        db.close()

    try:
        client = TestClient(app)

        response = client.get(
            f"/trips/{trip_id}/ev-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "EV data not found for this trip"

    finally:
        restore_db_override(previous_override)


def test_get_ev_status_requires_charging_with_safety_buffer():
    setup_database()

    previous_override = set_test_db_override()

    db = TestingSessionLocal()

    try:
        user = User(
            email="test@example.com",
            password_hash=hash_password("password123"),
            first_name="Test",
            last_name="User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        vehicle = Vehicle(
            user_id=user.id,
            name="Test EV",
            vehicle_type="car",
            fuel_type="electric",
            battery_capacity=60,
            energy_consumption=20,
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        trip = Trip(
            user_id=user.id,
            vehicle_id=vehicle.id,
            name="Safety Buffer Trip",
            start_location="Stockholm",
            destination="Uppsala",
            trip_type="road_trip",
            departure_at=datetime(2026, 9, 10, 9, 0),
            travelers=2,
            duration_days=1,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        trip_ev = TripEV(
            trip_id=trip.id,
            starting_battery_percentage=80,
            current_battery_percentage=80,
        )
        db.add(trip_ev)
        db.commit()

        trip_id = trip.id
        token = create_access_token(user.id)

    finally:
        db.close()

    fake_route_details = {
        "route": {
            "distance_meters": 200_000,
            "duration_seconds": 7200,
        },
        "locations": [],
        "legs": [],
        "days": [],
    }

    try:
        client = TestClient(app)

        with patch(
            "app.api.v1.ev_status.calculate_trip_route_details",
            return_value=fake_route_details,
        ):
            response = client.get(
                f"/trips/{trip_id}/ev-status",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 200

        data = response.json()

        assert data["available_range_km"] == 240
        assert data["usable_range_km"] == 192
        assert data["route_distance_km"] == 200
        assert data["needs_charging"] is True
        assert data["range_shortfall_km"] == 8

    finally:
        restore_db_override(previous_override)


def test_get_ev_status_does_not_require_charging_when_route_fits():
    setup_database()

    previous_override = set_test_db_override()

    db = TestingSessionLocal()

    try:
        user = User(
            email="test@example.com",
            password_hash=hash_password("password123"),
            first_name="Test",
            last_name="User",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        vehicle = Vehicle(
            user_id=user.id,
            name="Test EV",
            vehicle_type="car",
            fuel_type="electric",
            battery_capacity=60,
            energy_consumption=20,
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        trip = Trip(
            user_id=user.id,
            vehicle_id=vehicle.id,
            name="Short EV Trip",
            start_location="Stockholm",
            destination="Södertälje",
            trip_type="road_trip",
            departure_at=datetime(2026, 9, 10, 9, 0),
            travelers=2,
            duration_days=1,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)

        trip_ev = TripEV(
            trip_id=trip.id,
            starting_battery_percentage=80,
            current_battery_percentage=80,
        )
        db.add(trip_ev)
        db.commit()

        trip_id = trip.id
        token = create_access_token(user.id)

    finally:
        db.close()

    fake_route_details = {
        "route": {
            "distance_meters": 150_000,
            "duration_seconds": 5400,
        },
        "locations": [],
        "legs": [],
        "days": [],
    }

    try:
        client = TestClient(app)

        with patch(
            "app.api.v1.ev_status.calculate_trip_route_details",
            return_value=fake_route_details,
        ):
            response = client.get(
                f"/trips/{trip_id}/ev-status",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 200

        data = response.json()

        assert data["available_range_km"] == 240
        assert data["usable_range_km"] == 192
        assert data["route_distance_km"] == 150
        assert data["needs_charging"] is False
        assert data["range_shortfall_km"] == 0

    finally:
        restore_db_override(previous_override)