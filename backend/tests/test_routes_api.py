from datetime import datetime, timedelta
from unittest.mock import patch

import httpx
import pytest

from app.core.security import create_access_token
from app.models.trip import Trip


STOCKHOLM = (59.3293, 18.0686)
KARLSTAD = (59.4022, 13.5115)
OSLO = (59.9139, 10.7522)

MOCK_ROUTE = {
    "distance_meters": 520_000,
    "duration_seconds": 23_400,
    "legs": [
        {"distance_meters": 300_000, "duration_seconds": 13_000},
        {"distance_meters": 220_000, "duration_seconds": 10_400},
    ],
    "geometry": {
        "type": "LineString",
        "coordinates": [
            [18.0686, 59.3293],
            [13.5115, 59.4022],
            [10.7522, 59.9139],
        ],
    },
}


@pytest.fixture
def auth_headers(test_user):
    token = create_access_token(test_user.id)

    return {"Authorization": f"Bearer {token}"}


def test_geocode_returns_best_match(client, auth_headers):
    with patch(
        "app.api.v1.routes.search_location",
        return_value={
            "display_name": "Karlstad, Värmland County, Sweden",
            "latitude": KARLSTAD[0],
            "longitude": KARLSTAD[1],
        },
    ) as search:
        response = client.post(
            "/routes/geocode",
            json={"query": "  Karlstad "},
            headers=auth_headers,
        )

    assert response.status_code == 200
    assert response.json() == {
        "query": "Karlstad",
        "display_name": "Karlstad, Värmland County, Sweden",
        "latitude": KARLSTAD[0],
        "longitude": KARLSTAD[1],
    }
    search.assert_called_once_with("Karlstad")


def test_geocode_returns_404_when_not_found(client, auth_headers):
    with patch(
        "app.api.v1.routes.search_location",
        side_effect=ValueError("Location not found: Nowhere"),
    ):
        response = client.post(
            "/routes/geocode",
            json={"query": "Nowhere"},
            headers=auth_headers,
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Location not found: Nowhere"


def test_geocode_returns_502_when_service_fails(client, auth_headers):
    with patch(
        "app.api.v1.routes.search_location",
        side_effect=httpx.ConnectError("down"),
    ):
        response = client.post(
            "/routes/geocode",
            json={"query": "Oslo"},
            headers=auth_headers,
        )

    assert response.status_code == 502


def test_geocode_requires_authentication(client):
    response = client.post("/routes/geocode", json={"query": "Oslo"})

    assert response.status_code in (401, 403)


def test_preview_uses_given_coordinates_and_returns_geometry(
    client,
    auth_headers,
):
    with (
        patch(
            "app.services.route_preview.resolve_location",
        ) as resolve,
        patch(
            "app.services.route_preview.calculate_trip_route",
            return_value=MOCK_ROUTE,
        ) as calculate,
    ):
        response = client.post(
            "/routes/preview",
            json={
                "start": {
                    "location": "Stockholm",
                    "latitude": STOCKHOLM[0],
                    "longitude": STOCKHOLM[1],
                },
                "stops": [
                    {
                        "location": "Karlstad",
                        "latitude": KARLSTAD[0],
                        "longitude": KARLSTAD[1],
                    },
                ],
                "destination": {
                    "location": "Oslo",
                    "latitude": OSLO[0],
                    "longitude": OSLO[1],
                },
            },
            headers=auth_headers,
        )

    assert response.status_code == 200
    resolve.assert_not_called()

    start, destination, stops, _, trip_type = calculate.call_args.args
    assert start == STOCKHOLM
    assert destination == OSLO
    assert stops == [KARLSTAD]
    assert trip_type == "one_way"

    data = response.json()

    assert data["distance_meters"] == 520_000
    assert data["duration_seconds"] == 23_400
    assert data["geometry"] == MOCK_ROUTE["geometry"]
    assert [point["kind"] for point in data["points"]] == [
        "start",
        "stop",
        "destination",
    ]
    assert [
        (leg["from_location"], leg["to_location"]) for leg in data["legs"]
    ] == [
        ("Stockholm", "Karlstad"),
        ("Karlstad", "Oslo"),
    ]


def test_preview_looks_up_missing_coordinates(client, auth_headers):
    coordinates = {"Stockholm": STOCKHOLM, "Oslo": OSLO}

    with (
        patch(
            "app.services.route_preview.resolve_location",
            side_effect=lambda location: coordinates[location],
        ),
        patch(
            "app.services.route_preview.calculate_trip_route",
            return_value={**MOCK_ROUTE, "legs": MOCK_ROUTE["legs"][:1]},
        ),
    ):
        response = client.post(
            "/routes/preview",
            json={
                "start": {"location": "Stockholm"},
                "destination": {"location": "Oslo"},
            },
            headers=auth_headers,
        )

    assert response.status_code == 200

    points = response.json()["points"]

    assert (points[0]["latitude"], points[0]["longitude"]) == STOCKHOLM
    assert (points[1]["latitude"], points[1]["longitude"]) == OSLO


def test_preview_round_trip_leg_returns_to_start(client, auth_headers):
    with patch(
        "app.services.route_preview.calculate_trip_route",
        return_value=MOCK_ROUTE,
    ):
        response = client.post(
            "/routes/preview",
            json={
                "start": {
                    "location": "Stockholm",
                    "latitude": STOCKHOLM[0],
                    "longitude": STOCKHOLM[1],
                },
                "destination": {
                    "location": "Oslo",
                    "latitude": OSLO[0],
                    "longitude": OSLO[1],
                },
                "trip_type": "round_trip",
            },
            headers=auth_headers,
        )

    assert response.status_code == 200
    assert [
        (leg["from_location"], leg["to_location"])
        for leg in response.json()["legs"]
    ] == [
        ("Stockholm", "Oslo"),
        ("Oslo", "Stockholm"),
    ]


def test_preview_returns_400_for_unknown_location(client, auth_headers):
    with patch(
        "app.services.route_preview.resolve_location",
        side_effect=ValueError("Location not found: Atlantis"),
    ):
        response = client.post(
            "/routes/preview",
            json={
                "start": {"location": "Atlantis"},
                "destination": {"location": "Oslo"},
            },
            headers=auth_headers,
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Location not found: Atlantis"


def test_preview_returns_502_when_routing_service_fails(client, auth_headers):
    with patch(
        "app.services.route_preview.calculate_trip_route",
        side_effect=httpx.ReadTimeout("slow"),
    ):
        response = client.post(
            "/routes/preview",
            json={
                "start": {
                    "location": "Stockholm",
                    "latitude": STOCKHOLM[0],
                    "longitude": STOCKHOLM[1],
                },
                "destination": {
                    "location": "Oslo",
                    "latitude": OSLO[0],
                    "longitude": OSLO[1],
                },
            },
            headers=auth_headers,
        )

    assert response.status_code == 502


def test_trip_route_includes_geometry(client, auth_headers, test_user, db):
    trip = Trip(
        user_id=test_user.id,
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

    with patch(
        "app.services.trip_route.resolve_location",
        side_effect=lambda location: {"Stockholm": STOCKHOLM, "Oslo": OSLO}[
            location
        ],
    ), patch(
        "app.services.trip_route.calculate_trip_route",
        return_value={**MOCK_ROUTE, "legs": MOCK_ROUTE["legs"][:1]},
    ):
        response = client.get(
            f"/trips/{trip.id}/route",
            headers=auth_headers,
        )

    assert response.status_code == 200
    assert response.json()["geometry"] == MOCK_ROUTE["geometry"]
