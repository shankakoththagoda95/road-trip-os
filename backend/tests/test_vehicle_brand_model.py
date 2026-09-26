import pytest

from app.core.security import create_access_token


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


VEHICLE = {
    "name": "Family car",
    "vehicle_type": "car",
    "fuel_type": "diesel",
    "fuel_consumption": 6.0,
    "tank_capacity": 60,
}


def test_create_vehicle_with_brand_and_model(client, auth_headers):
    response = client.post(
        "/vehicles/",
        json={**VEHICLE, "brand": " Volvo ", "model": "XC90"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["brand"] == "Volvo"
    assert response.json()["model"] == "XC90"


def test_brand_and_model_are_optional(client, auth_headers):
    response = client.post("/vehicles/", json=VEHICLE, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["brand"] is None
    assert response.json()["model"] is None


def test_blank_brand_and_model_are_stored_as_empty(client, auth_headers):
    response = client.post(
        "/vehicles/",
        json={**VEHICLE, "brand": "  ", "model": ""},
        headers=auth_headers,
    )

    assert response.json()["brand"] is None
    assert response.json()["model"] is None


def test_update_brand_and_model(client, auth_headers):
    vehicle_id = client.post(
        "/vehicles/",
        json={**VEHICLE, "brand": "Volvo", "model": "V70"},
        headers=auth_headers,
    ).json()["id"]

    response = client.put(
        f"/vehicles/{vehicle_id}",
        json={**VEHICLE, "brand": "Volvo", "model": "V90"},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["model"] == "V90"
    assert (
        client.get(f"/vehicles/{vehicle_id}", headers=auth_headers).json()["model"]
        == "V90"
    )


def test_brand_longer_than_60_characters_is_rejected(client, auth_headers):
    response = client.post(
        "/vehicles/",
        json={**VEHICLE, "brand": "x" * 61},
        headers=auth_headers,
    )

    assert response.status_code == 422
