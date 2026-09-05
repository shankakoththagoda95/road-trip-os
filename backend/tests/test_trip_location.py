from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.base import Base
from app.models.trip import Trip
from app.models.trip_location import TripLocation
from app.models.user import User
from app.schemas.trip_location import TripLocationCreate
from app.models.trip_fuel import TripFuel
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


def test_trip_location_model_can_be_created():
    recorded_at = datetime(2026, 9, 5, 12, 0, 0)

    location = TripLocation(
        trip_id=1,
        latitude=59.3293,
        longitude=18.0686,
        recorded_at=recorded_at,
    )

    assert location.trip_id == 1
    assert location.latitude == 59.3293
    assert location.longitude == 18.0686
    assert location.recorded_at == recorded_at


def test_trip_location_accepts_valid_coordinates():
    location = TripLocationCreate(
        latitude=59.3293,
        longitude=18.0686,
    )

    assert location.latitude == 59.3293
    assert location.longitude == 18.0686


def test_trip_location_rejects_invalid_latitude():
    try:
        TripLocationCreate(
            latitude=91,
            longitude=18,
        )
        assert False
    except ValidationError:
        assert True


def test_trip_location_rejects_invalid_longitude():
    try:
        TripLocationCreate(
            latitude=59,
            longitude=181,
        )
        assert False
    except ValidationError:
        assert True


def test_record_trip_location(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
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

        response = client.post(
            f"/trips/{trip.id}/locations",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "latitude": 59.3293,
                "longitude": 18.0686,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["id"] is not None
        assert data["trip_id"] == trip.id
        assert data["latitude"] == 59.3293
        assert data["longitude"] == 18.0686
        assert data["recorded_at"] is not None

    finally:
        db.close()


def test_record_trip_location_cannot_access_another_users_trip(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        trip = Trip(
            user_id=owner.id,
            name="Owner Trip",
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

        other_user = create_test_user(
            db,
            email="other@example.com",
        )

        token = create_access_token(other_user.id)

        response = client.post(
            f"/trips/{trip.id}/locations",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "latitude": 59.3293,
                "longitude": 18.0686,
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Trip not found"

    finally:
        db.close()


def test_record_trip_location_returns_404_for_missing_trip(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        token = create_access_token(user.id)

        response = client.post(
            "/trips/999/locations",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "latitude": 59.3293,
                "longitude": 18.0686,
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Trip not found"

    finally:
        db.close()


def test_record_trip_location_rejects_invalid_coordinates(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
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

        response = client.post(
            f"/trips/{trip.id}/locations",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "latitude": 91,
                "longitude": 18.0686,
            },
        )

        assert response.status_code == 422

    finally:
        db.close()


def test_record_trip_location_is_saved_to_database(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
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

        response = client.post(
            f"/trips/{trip.id}/locations",
            headers={
                "Authorization": f"Bearer {token}",
            },
            json={
                "latitude": 59.3293,
                "longitude": 18.0686,
            },
        )

        assert response.status_code == 200

        saved_location = (
            db.query(TripLocation)
            .filter(TripLocation.trip_id == trip.id)
            .first()
        )

        assert saved_location is not None
        assert saved_location.latitude == 59.3293
        assert saved_location.longitude == 18.0686
        assert saved_location.recorded_at is not None

    finally:
        db.close()


def test_get_trip_fuel_status(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6,
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

        trip_fuel = TripFuel(
            trip_id=trip.id,
            starting_fuel=55,
            current_fuel=55,
            fuel_used=0,
            fuel_cost=0,
        )

        locations = [
            TripLocation(
                trip_id=trip.id,
                latitude=59.3293,
                longitude=18.0686,
                recorded_at=datetime(2026, 9, 5, 12, 0, 0),
            ),
            TripLocation(
                trip_id=trip.id,
                latitude=59.4370,
                longitude=18.0777,
                recorded_at=datetime(2026, 9, 5, 13, 0, 0),
            ),
        ]

        db.add(trip_fuel)
        db.add_all(locations)
        db.commit()

        token = create_access_token(user.id)

        response = client.get(
            f"/trips/{trip.id}/fuel-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["trip_id"] == trip.id
        assert data["distance_traveled_km"] > 0
        assert data["fuel_remaining"] < 55
        assert data["remaining_range_km"] > 0

    finally:
        db.close()


def test_get_trip_fuel_status_with_no_locations(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6,
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

        trip_fuel = TripFuel(
            trip_id=trip.id,
            starting_fuel=55,
            current_fuel=55,
            fuel_used=0,
            fuel_cost=0,
        )

        db.add(trip_fuel)
        db.commit()

        token = create_access_token(user.id)

        response = client.get(
            f"/trips/{trip.id}/fuel-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["distance_traveled_km"] == 0
        assert data["fuel_remaining"] == 55
        assert data["remaining_range_km"] == pytest.approx(916.6666667)

    finally:
        db.close()


def test_get_trip_fuel_status_requires_vehicle(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
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
            f"/trips/{trip.id}/fuel-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Trip does not have a vehicle"

    finally:
        db.close()


def test_get_trip_fuel_status_requires_starting_fuel(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6,
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
            f"/trips/{trip.id}/fuel-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Trip does not have starting fuel data"

    finally:
        db.close()


def test_get_trip_fuel_status_cannot_access_another_users_trip(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        vehicle = Vehicle(
            user_id=owner.id,
            name="Owner Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=6,
            tank_capacity=55,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        trip = Trip(
            user_id=owner.id,
            vehicle_id=vehicle.id,
            name="Owner Trip",
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

        other_user = create_test_user(
            db,
            email="other@example.com",
        )

        token = create_access_token(other_user.id)

        response = client.get(
            f"/trips/{trip.id}/fuel-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Trip not found"

    finally:
        db.close()


def test_get_trip_fuel_status_calculates_expected_values(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        vehicle = Vehicle(
            user_id=user.id,
            name="My Car",
            vehicle_type="car",
            fuel_type="petrol",
            fuel_consumption=10,
            tank_capacity=50,
        )

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

        trip = Trip(
            user_id=user.id,
            vehicle_id=vehicle.id,
            name="Short Trip",
            start_location="Stockholm",
            destination="Nearby",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=1,
            duration_days=1,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        trip_fuel = TripFuel(
            trip_id=trip.id,
            starting_fuel=50,
            current_fuel=50,
            fuel_used=0,
            fuel_cost=0,
        )

        locations = [
            TripLocation(
                trip_id=trip.id,
                latitude=59.3293,
                longitude=18.0686,
                recorded_at=datetime(2026, 9, 5, 12, 0, 0),
            ),
            TripLocation(
                trip_id=trip.id,
                latitude=59.3393,
                longitude=18.0686,
                recorded_at=datetime(2026, 9, 5, 13, 0, 0),
            ),
        ]

        db.add(trip_fuel)
        db.add_all(locations)
        db.commit()

        token = create_access_token(user.id)

        response = client.get(
            f"/trips/{trip.id}/fuel-status",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        data = response.json()

        expected_distance = 1.11195
        expected_fuel_remaining = 50 - (expected_distance / 100 * 10)
        expected_range = expected_fuel_remaining / 10 * 100

        assert data["distance_traveled_km"] == pytest.approx(
            expected_distance,
            rel=0.01,
        )
        assert data["fuel_remaining"] == pytest.approx(
            expected_fuel_remaining,
            rel=0.01,
        )
        assert data["remaining_range_km"] == pytest.approx(
            expected_range,
            rel=0.01,
        )

    finally:
        db.close()