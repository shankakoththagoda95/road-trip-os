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