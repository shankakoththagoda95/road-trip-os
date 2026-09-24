from datetime import date, datetime, timedelta
from unittest.mock import patch

import pytest

from app.core.security import create_access_token
from app.services.itinerary import schedule_driving_days
from app.services.itinerary_preview import legs_over_limit, preview_itinerary


HOUR = 3600
DEPARTURE = datetime(2026, 10, 1, 9, 0)


def leg(start, end, hours, km):
    return {
        "from_location": start,
        "to_location": end,
        "distance_meters": km * 1000,
        "duration_seconds": hours * HOUR,
    }


ONE_WAY = [
    leg("Stockholm", "Örebro", 2, 200),
    leg("Örebro", "Karlstad", 1.5, 110),
    leg("Karlstad", "Oslo", 3, 220),
]

ROUND_TRIP = [
    leg("Stockholm", "Oslo", 6, 530),
    leg("Oslo", "Stockholm", 6, 530),
]


def route(legs):
    return {
        "distance_meters": sum(item["distance_meters"] for item in legs),
        "duration_seconds": sum(item["duration_seconds"] for item in legs),
        "legs": legs,
    }


def test_one_way_days_are_consecutive():
    days, warnings = schedule_driving_days(ONE_WAY, "one_way", 5, None, 4)

    assert [day.day_number for day in days] == [1, 2]
    assert warnings == []


def test_round_trip_returns_on_last_day():
    days, warnings = schedule_driving_days(ROUND_TRIP, "round_trip", 5, None, 8)

    assert [day.day_number for day in days] == [1, 5]
    assert days[1].legs[0]["from_location"] == "Oslo"
    assert warnings == []


def test_round_trip_without_limits_still_drives_home_at_the_end():
    days, _ = schedule_driving_days(ROUND_TRIP, "round_trip", 3, None, None)

    assert [day.day_number for day in days] == [1, 3]


def test_too_many_driving_days_warns_and_stays_consecutive():
    days, warnings = schedule_driving_days(ONE_WAY, "one_way", 1, None, 4)

    assert [day.day_number for day in days] == [1, 2]
    assert warnings == ["The driving needs 2 days but the trip is 1 day long"]


def test_round_trip_too_short_is_consecutive_with_warning():
    days, warnings = schedule_driving_days(ROUND_TRIP, "round_trip", 1, None, 8)

    assert [day.day_number for day in days] == [1, 2]
    assert "needs 2 days" in warnings[0]


def test_legs_over_limit_explains_the_problem():
    problems = legs_over_limit(ROUND_TRIP, None, 5)

    assert problems[0] == (
        "Stockholm → Oslo takes 6 h, more than your 5 h daily limit. "
        "Add a stop in between or raise the limit."
    )
    assert len(problems) == 2


def test_distance_limit_allows_ten_percent_tolerance():
    assert legs_over_limit([leg("A", "B", 1, 540)], 500, None) == []
    assert "550" not in legs_over_limit([leg("A", "B", 1, 560)], 500, None)[0]
    assert "560 km" in legs_over_limit([leg("A", "B", 1, 560)], 500, None)[0]


def test_preview_lists_every_trip_day():
    result = preview_itinerary(
        route(ROUND_TRIP),
        "round_trip",
        DEPARTURE,
        4,
        None,
        8,
    )

    assert [day["driving"] for day in result["days"]] == [True, False, False, True]
    assert [day["date"] for day in result["days"]] == [
        date(2026, 10, 1),
        date(2026, 10, 2),
        date(2026, 10, 3),
        date(2026, 10, 4),
    ]
    # Free days are spent where the last drive ended.
    assert result["days"][1]["from_location"] == "Oslo"
    assert result["days"][1]["to_location"] == "Oslo"
    assert result["driving_days"] == 2
    assert result["problems"] == []


def test_preview_returns_problems_instead_of_days_for_long_legs():
    result = preview_itinerary(
        route(ROUND_TRIP),
        "round_trip",
        DEPARTURE,
        4,
        None,
        5,
    )

    assert result["days"] == []
    assert len(result["problems"]) == 2


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


def test_itinerary_endpoint(client, auth_headers):
    departure = (datetime.now() + timedelta(days=3)).replace(microsecond=0)

    with patch(
        "app.api.v1.routes.preview_route",
        return_value={**route(ONE_WAY), "points": [], "geometry": {}},
    ):
        response = client.post(
            "/routes/itinerary",
            json={
                "start": {"location": "Stockholm", "latitude": 59.33, "longitude": 18.07},
                "destination": {"location": "Oslo", "latitude": 59.91, "longitude": 10.75},
                "departure_at": departure.isoformat(),
                "duration_days": 3,
                "max_driving_hours_per_day": 4,
            },
            headers=auth_headers,
        )

    assert response.status_code == 200

    data = response.json()

    assert [day["driving"] for day in data["days"]] == [True, True, False]
    assert data["days"][0]["to_location"] == "Karlstad"
    assert data["days"][1]["from_location"] == "Karlstad"
    assert data["days"][1]["to_location"] == "Oslo"
    assert data["days"][0]["driving_time_status"] == "within_limit"
