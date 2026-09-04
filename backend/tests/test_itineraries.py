from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
import pytest

from sqlalchemy.orm import sessionmaker

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.base import Base
from app.models.itinerary import Itinerary
from app.models.itinerary_day import ItineraryDay
from app.models.trip import Trip
from app.models.trip_destination import TripDestination
from app.models.user import User
from app.services import itinerary as itinerary_service


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


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


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


def create_test_trip(db, user_id):
    trip = Trip(
        user_id=user_id,
        name="Stockholm to Oslo",
        start_location="Stockholm, Sweden",
        destination="Oslo, Norway",
        trip_type="one_way",
        departure_at=datetime.now() + timedelta(days=7),
        travelers=2,
        duration_days=2,
        max_driving_hours_per_day=8,
        max_distance_per_day=500,
    )

    db.add(trip)
    db.commit()
    db.refresh(trip)

    return trip


def create_test_destination(db, trip_id):
    destination = TripDestination(
        trip_id=trip_id,
        location="Örebro, Sweden",
        latitude=59.2753,
        longitude=15.2134,
        stop_order=1,
    )

    db.add(destination)
    db.commit()
    db.refresh(destination)

    return destination


def test_generate_itinerary_days(monkeypatch):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)
        trip = create_test_trip(db, user.id)
        destination = create_test_destination(db, trip.id)

        monkeypatch.setattr(
            itinerary_service,
            "resolve_location",
            lambda location: (59.3293, 18.0686)
            if "Stockholm" in location
            else (59.3293, 18.0686),
        )

        monkeypatch.setattr(
            itinerary_service,
            "calculate_trip_route",
            lambda *args, **kwargs: {
                "distance_meters": 900000,
                "duration_seconds": 28800,
                "legs": [
                    {
                        "distance_meters": 450000,
                        "duration_seconds": 14400,
                    },
                    {
                        "distance_meters": 450000,
                        "duration_seconds": 14400,
                    },
                ],
            },
        )

        route, days = itinerary_service.generate_itinerary_days(
            trip,
            [destination],
        )

        assert route["distance_meters"] == 900000
        assert route["duration_seconds"] == 28800
        assert len(days) == 2

    finally:
        db.close()


def test_no_constraints_produces_one_day(monkeypatch):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)
        trip = create_test_trip(db, user.id)

        trip.max_distance_per_day = None
        trip.max_driving_hours_per_day = None

        db.commit()

        monkeypatch.setattr(
            itinerary_service,
            "resolve_location",
            lambda location: (59.3293, 18.0686),
        )

        monkeypatch.setattr(
            itinerary_service,
            "calculate_trip_route",
            lambda *args, **kwargs: {
                "distance_meters": 800000,
                "duration_seconds": 20000,
                "legs": [
                    {
                        "distance_meters": 800000,
                        "duration_seconds": 20000,
                    },
                ],
            },
        )

        route, days = itinerary_service.generate_itinerary_days(
            trip,
            [],
        )

        assert len(days) == 1
        assert days[0].total_distance_meters == 800000
        assert days[0].total_duration_seconds == 20000

    finally:
        db.close()


def test_itinerary_endpoint_saves_itinerary_and_days(monkeypatch):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)
        trip = create_test_trip(db, user.id)
        destination = create_test_destination(db, trip.id)

        monkeypatch.setattr(
            itinerary_service,
            "resolve_location",
            lambda location: (59.3293, 18.0686),
        )

        monkeypatch.setattr(
            itinerary_service,
            "calculate_trip_route",
            lambda *args, **kwargs: {
                "distance_meters": 900000,
                "duration_seconds": 28800,
                "legs": [
                    {
                        "distance_meters": 450000,
                        "duration_seconds": 14400,
                    },
                    {
                        "distance_meters": 450000,
                        "duration_seconds": 14400,
                    },
                ],
            },
        )

        token = create_access_token(user.id)

        response = client.post(
            f"/itineraries/trips/{trip.id}/itinerary",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        saved_itinerary = db.query(Itinerary).first()

        assert saved_itinerary is not None
        assert saved_itinerary.trip_id == trip.id

        saved_days = (
            db.query(ItineraryDay)
            .filter(
                ItineraryDay.itinerary_id
                == saved_itinerary.id
            )
            .all()
        )

        assert len(saved_days) == 2

    finally:
        db.close()


def test_get_saved_itinerary(monkeypatch):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)
        trip = create_test_trip(db, user.id)

        itinerary = Itinerary(
            trip_id=trip.id,
        )

        db.add(itinerary)
        db.flush()

        db.add_all(
            [
                ItineraryDay(
                    itinerary_id=itinerary.id,
                    day_number=1,
                    total_distance_meters=450000,
                    total_duration_seconds=14400,
                    distance_status="within_limit",
                    driving_time_status="within_limit",
                ),
                ItineraryDay(
                    itinerary_id=itinerary.id,
                    day_number=2,
                    total_distance_meters=450000,
                    total_duration_seconds=14400,
                    distance_status="within_limit",
                    driving_time_status="within_limit",
                ),
            ]
        )

        db.commit()

        token = create_access_token(user.id)

        response = client.get(
            f"/itineraries/trips/{trip.id}/itinerary",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["trip_id"] == trip.id
        assert len(data["days"]) == 2
        assert data["days"][0]["day_number"] == 1
        assert data["days"][1]["day_number"] == 2

    finally:
        db.close()


def test_user_cannot_access_another_users_itinerary():
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        trip = create_test_trip(db, owner.id)

        itinerary = Itinerary(
            trip_id=trip.id,
        )

        db.add(itinerary)
        db.commit()

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
            f"/itineraries/trips/{trip.id}/itinerary",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404

    finally:
        db.close()