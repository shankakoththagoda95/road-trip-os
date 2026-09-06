import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def register_and_login_user(email: str):
    email = f"{uuid.uuid4()}-{email}"

    register_response = client.post(
        "/users/",
        json={
            "email": email,
            "password": "TestPassword123!",
            "first_name": "Test",
            "last_name": "User",
        },
    )

    assert register_response.status_code == 200

    login_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "TestPassword123!",
        },
    )

    assert login_response.status_code == 200

    token = login_response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}",
    }


def test_get_user_settings_creates_default_settings():
    headers = register_and_login_user(
        "settings-default@example.com"
    )

    response = client.get(
        "/users/settings",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "gps_movement_threshold_meters": 20.0,
    }


def test_get_user_settings_returns_existing_settings():
    headers = register_and_login_user(
        "settings-existing@example.com"
    )

    update_response = client.put(
        "/users/settings",
        headers=headers,
        json={
            "gps_movement_threshold_meters": 100,
        },
    )

    assert update_response.status_code == 200

    response = client.get(
        "/users/settings",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == {
        "gps_movement_threshold_meters": 100,
    }


def test_update_user_settings():
    headers = register_and_login_user(
        "settings-update@example.com"
    )

    response = client.put(
        "/users/settings",
        headers=headers,
        json={
            "gps_movement_threshold_meters": 50,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "gps_movement_threshold_meters": 50,
    }


@pytest.mark.parametrize(
    "threshold",
    [0, -1, 1001, 2000],
)
def test_update_user_settings_rejects_invalid_threshold(
    threshold,
):
    headers = register_and_login_user(
        f"settings-invalid-{threshold}@example.com"
    )

    response = client.put(
        "/users/settings",
        headers=headers,
        json={
            "gps_movement_threshold_meters": threshold,
        },
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "threshold",
    [1, 20, 1000],
)
def test_update_user_settings_accepts_boundary_values(
    threshold,
):
    headers = register_and_login_user(
        f"settings-valid-{threshold}@example.com"
    )

    response = client.put(
        "/users/settings",
        headers=headers,
        json={
            "gps_movement_threshold_meters": threshold,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "gps_movement_threshold_meters": threshold,
    }


def test_user_settings_requires_authentication():
    get_response = client.get("/users/settings")

    assert get_response.status_code == 401

    put_response = client.put(
        "/users/settings",
        json={
            "gps_movement_threshold_meters": 50,
        },
    )

    assert put_response.status_code == 401


def test_fuel_status_uses_user_gps_threshold():
    headers = register_and_login_user(
        "settings-fuel-status@example.com"
    )

    settings_response = client.put(
        "/users/settings",
        json={
            "gps_movement_threshold_meters": 100,
        },
        headers=headers,
    )

    assert settings_response.status_code == 200
    assert (
        settings_response.json()["gps_movement_threshold_meters"]
        == 100
    )