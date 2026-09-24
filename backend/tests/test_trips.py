from datetime import datetime, timedelta, timezone
from unittest.mock import patch

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
from app.models.trip_destination import TripDestination
from app.services.tolls import TollProvider
from app.services.borders import BorderCalculation, BorderCrossing
from app.services.travel_checklist import TravelChecklist, TravelChecklistItem
from app.schemas.trip import TripType


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


def test_create_trip_accepts_utc_departure_string(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)
        token = create_access_token(user.id)

        departure_at = datetime.now(timezone.utc) + timedelta(days=1)

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
                "departure_at": departure_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "travelers": 2,
                "duration_days": 2,
            },
        )

        assert response.status_code == 200
        assert response.json()["departure_at"] == departure_at.strftime(
            "%Y-%m-%dT%H:%M:%S"
        )

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


def test_get_trip_fuel_estimate(client):
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

        mock_route = {
            "route": {
                "distance_meters": 600_000,
            },
        }

        with patch(
            "app.api.v1.trips.calculate_trip_route_details",
            return_value=mock_route,
        ):
            response = client.get(
                f"/trips/{trip.id}/fuel-estimate?fuel_price_per_liter=1.80",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 200

        data = response.json()

        assert data["trip_id"] == trip.id
        assert data["distance_km"] == 600
        assert data["fuel_required"] == 36
        assert data["fuel_price_per_liter"] == 1.80
        assert data["estimated_fuel_cost"] == 64.8

    finally:
        db.close()


def test_get_trip_tolls(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
            name="Stockholm to Gothenburg",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=1,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        mock_route = {
            "route": {
                "geometry": {
                    "coordinates": [
                        [18.0686, 59.3293],
                        [11.9746, 57.7089],
                    ],
                },
            },
        }

        with patch(
            "app.services.trip_route.calculate_trip_route_details",
            return_value=mock_route,
        ):
            response = client.get(
                f"/trips/{trip.id}/tolls",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 200

        data = response.json()

        assert data["trip_id"] == trip.id
        assert data["fees"] == []
        assert data["total_amount"] == 0.0
        assert data["currency"] == "EUR"

    finally:
        db.close()


def test_get_trip_tolls_cannot_access_another_users_trip(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        trip = Trip(
            user_id=owner.id,
            name="Private Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=1,
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

        token = create_access_token(other_user.id)

        response = client.get(
            f"/trips/{trip.id}/tolls",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Trip not found"

    finally:
        db.close()


def test_get_trip_tolls_returns_400_when_route_calculation_fails(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
            name="Invalid Route Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=1,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        with patch(
            "app.services.trip_route.calculate_trip_route_details",
            side_effect=ValueError("Route could not be calculated"),
        ):
            response = client.get(
                f"/trips/{trip.id}/tolls",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 400
        assert response.json()["detail"] == "Route could not be calculated"

    finally:
        db.close()


def test_get_trip_borders(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
            name="Stockholm to Germany",
            start_location="Stockholm",
            destination="Germany",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=2,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        mock_result = BorderCalculation(
            countries=["Sweden", "Denmark", "Germany"],
            crossings=[
                BorderCrossing(
                    from_country="Sweden",
                    to_country="Denmark",
                ),
                BorderCrossing(
                    from_country="Denmark",
                    to_country="Germany",
                ),
            ],
        )

        with patch(
            "app.api.v1.trips.calculate_trip_route_borders",
            return_value=mock_result,
        ):
            response = client.get(
                f"/trips/{trip.id}/borders",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 200

        data = response.json()

        assert data["trip_id"] == trip.id
        assert data["countries"] == [
            "Sweden",
            "Denmark",
            "Germany",
        ]

        assert len(data["crossings"]) == 2

        assert data["crossings"][0]["from_country"] == "Sweden"
        assert data["crossings"][0]["to_country"] == "Denmark"
        assert data["crossings"][0]["location"] is None

        assert data["crossings"][1]["from_country"] == "Denmark"
        assert data["crossings"][1]["to_country"] == "Germany"
        assert data["crossings"][1]["location"] is None

    finally:
        db.close()


def test_get_trip_borders_cannot_access_another_users_trip(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        trip = Trip(
            user_id=owner.id,
            name="Private Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=1,
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

        token = create_access_token(other_user.id)

        response = client.get(
            f"/trips/{trip.id}/borders",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Trip not found"

    finally:
        db.close()


def test_get_trip_borders_returns_400_when_route_calculation_fails(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
            name="Invalid Route Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=1,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        with patch(
            "app.api.v1.trips.calculate_trip_route_borders",
            side_effect=ValueError("Route could not be calculated"),
        ):
            response = client.get(
                f"/trips/{trip.id}/borders",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 400
        assert response.json()["detail"] == "Route could not be calculated"

    finally:
        db.close()


def test_get_trip_travel_checklist(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
            name="Sweden Road Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=1,
            duration_days=1,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        mock_result = TravelChecklist(
            items=[
                TravelChecklistItem(
                    name="Passport",
                    required=True,
                    description="Valid passport required for international travel.",
                ),
                TravelChecklistItem(
                    name="Travel Insurance",
                    required=False,
                    description="Recommended for international travel.",
                ),
            ],
        )

        with patch(
            "app.api.v1.trips.calculate_trip_travel_checklist",
            return_value=mock_result,
        ):
            response = client.get(
                f"/trips/{trip.id}/travel-checklist",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 200

        data = response.json()

        assert data["trip_id"] == trip.id
        assert len(data["items"]) == 2

        assert data["items"][0]["name"] == "Passport"
        assert data["items"][0]["required"] is True
        assert (
            data["items"][0]["description"]
            == "Valid passport required for international travel."
        )

        assert data["items"][1]["name"] == "Travel Insurance"
        assert data["items"][1]["required"] is False
        assert (
            data["items"][1]["description"]
            == "Recommended for international travel."
        )

    finally:
        db.close()


def test_get_trip_travel_checklist_cannot_access_another_users_trip(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        trip = Trip(
            user_id=owner.id,
            name="Private Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=1,
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

        token = create_access_token(other_user.id)

        response = client.get(
            f"/trips/{trip.id}/travel-checklist",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Trip not found"

    finally:
        db.close()


def test_get_trip_travel_checklist_returns_400_when_calculation_fails(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
            name="Invalid Route Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=2,
            duration_days=1,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        with patch(
            "app.api.v1.trips.calculate_trip_travel_checklist",
            side_effect=ValueError("Route could not be calculated"),
        ):
            response = client.get(
                f"/trips/{trip.id}/travel-checklist",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 400
        assert response.json()["detail"] == "Route could not be calculated"

    finally:
        db.close()


def test_get_trip_travel_checklist(client):
    db = TestingSessionLocal()

    try:
        user = create_test_user(db)

        trip = Trip(
            user_id=user.id,
            name="Sweden Road Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=1,
            duration_days=1,
        )

        db.add(trip)
        db.commit()
        db.refresh(trip)

        token = create_access_token(user.id)

        mock_result = TravelChecklist(
            items=[],
        )

        with patch(
            "app.api.v1.trips.calculate_trip_travel_checklist",
            return_value=mock_result,
        ):
            response = client.get(
                f"/trips/{trip.id}/travel-checklist",
                headers={
                    "Authorization": f"Bearer {token}",
                },
            )

        assert response.status_code == 200

        data = response.json()

        assert data["trip_id"] == trip.id
        assert data["items"] == []

    finally:
        db.close()


def test_get_trip_travel_checklist_cannot_access_another_users_trip(client):
    db = TestingSessionLocal()

    try:
        owner = create_test_user(db)

        trip = Trip(
            user_id=owner.id,
            name="Private Trip",
            start_location="Stockholm",
            destination="Gothenburg",
            trip_type="one_way",
            departure_at=datetime.now() + timedelta(days=1),
            travelers=1,
            duration_days=1,
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

        token = create_access_token(other_user.id)

        response = client.get(
            f"/trips/{trip.id}/travel-checklist",
            headers={
                "Authorization": f"Bearer {token}",
            },
        )

        assert response.status_code == 404
        assert response.json()["detail"] == "Trip not found"

    finally:
        db.close()