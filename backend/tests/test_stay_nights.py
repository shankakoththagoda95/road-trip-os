from datetime import date, datetime, timedelta

import pytest

from app.core.security import create_access_token
from app.schemas.route import RoutePointInput, RoutePreviewRequest
from app.schemas.trip import TripType
from app.services.itinerary import schedule_driving_days
from app.services.itinerary_preview import preview_itinerary
from app.services.route_conditions import arrival_dates
from app.services.route_preview import stay_nights

HOUR = 3600


def leg(start, end, hours=3.0, km=250):
    return {
        "from_location": start,
        "to_location": end,
        "distance_meters": km * 1000,
        "duration_seconds": hours * HOUR,
    }


def day_numbers(days):
    return [(day.day_number, day.legs[0]["from_location"], day.legs[-1]["to_location"]) for day in days]


def test_one_way_waits_at_each_stay_and_drives_through_zero_night_stops():
    legs = [leg("A", "B"), leg("B", "C"), leg("C", "D")]

    days, warnings = schedule_driving_days(
        legs, "one_way", 5, None, None, stay_nights=[2, 0, 1]
    )

    # Day 1 to B, two nights there, then B → C → D in one go on day 3.
    assert day_numbers(days) == [(1, "A", "B"), (3, "B", "D")]
    assert warnings == []


def test_round_trip_keeps_spare_days_at_last_stay_and_drives_home_at_the_end():
    legs = [leg("A", "B"), leg("B", "C"), leg("C", "A")]

    days, warnings = schedule_driving_days(
        legs, "round_trip", 7, None, None, stay_nights=[1, 2, 0]
    )

    assert day_numbers(days) == [(1, "A", "B"), (2, "B", "C"), (7, "C", "A")]
    assert warnings == []


def test_daily_limit_still_splits_driving_between_stays():
    legs = [leg("A", "B", hours=6), leg("B", "C", hours=6)]

    days, _ = schedule_driving_days(
        legs, "one_way", 5, None, 8, stay_nights=[0, 2]
    )

    assert day_numbers(days) == [(1, "A", "B"), (2, "B", "C")]


def test_stays_longer_than_the_trip_are_reported():
    legs = [leg("A", "B"), leg("B", "C")]

    days, warnings = schedule_driving_days(
        legs, "one_way", 3, None, None, stay_nights=[5, 0]
    )

    assert day_numbers(days) == [(1, "A", "B"), (6, "B", "C")]
    assert warnings == ["Your stays and driving need 6 days but the trip is 3 days long"]


def test_no_nights_keeps_the_previous_schedule():
    legs = [leg("A", "B"), leg("B", "A")]

    with_zeros, _ = schedule_driving_days(legs, "round_trip", 4, None, None, stay_nights=[0, 0])
    without, _ = schedule_driving_days(legs, "round_trip", 4, None, None)

    assert day_numbers(with_zeros) == day_numbers(without) == [(1, "A", "B"), (4, "B", "A")]


def test_preview_shows_free_days_at_the_place_being_stayed_at():
    route = {
        "distance_meters": 500_000,
        "duration_seconds": 6 * HOUR,
        "legs": [leg("Munich", "Hallstatt"), leg("Hallstatt", "Salzburg")],
    }

    plan = preview_itinerary(
        route,
        trip_type="one_way",
        departure_at=datetime(2027, 5, 1, 9),
        duration_days=4,
        max_distance_per_day=None,
        max_driving_hours_per_day=None,
        stay_nights=[2, 1],
    )

    summary = [(day["day_number"], day["driving"], day["from_location"], day["to_location"]) for day in plan["days"]]
    assert summary == [
        (1, True, "Munich", "Hallstatt"),
        (2, False, "Hallstatt", "Hallstatt"),
        (3, True, "Hallstatt", "Salzburg"),
        (4, False, "Salzburg", "Salzburg"),
    ]


def test_arrival_dates_follow_the_stays():
    dates = arrival_dates(
        datetime(2027, 5, 1, 9),
        [3 * HOUR, 3 * HOUR, 3 * HOUR],
        None,
        stay_nights=[2, 0, 1],
    )

    assert dates == [
        date(2027, 5, 1),
        date(2027, 5, 1),
        date(2027, 5, 3),
        date(2027, 5, 3),
    ]


def test_stay_nights_are_aligned_with_legs():
    request = RoutePreviewRequest(
        start=RoutePointInput(location="A", nights=4),
        stops=[RoutePointInput(location="B", nights=2)],
        destination=RoutePointInput(location="C", nights=1),
        trip_type=TripType.ROUND_TRIP,
    )

    # The start's nights are ignored; nothing after driving home.
    assert stay_nights(request) == [2, 1, 0]


def test_nights_must_be_reasonable():
    with pytest.raises(ValueError):
        RoutePointInput(location="A", nights=-1)
    with pytest.raises(ValueError):
        RoutePointInput(location="A", nights=91)


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


def test_nights_are_saved_on_trips_and_stops(client, auth_headers):
    trip = client.post(
        "/trips/",
        headers=auth_headers,
        json={
            "name": "Alps",
            "start_location": "Munich",
            "destination": "Salzburg",
            "trip_type": "one_way",
            "departure_at": (datetime.now() + timedelta(days=5)).isoformat(),
            "travelers": 2,
            "duration_days": 5,
            "destination_nights": 2,
        },
    )
    assert trip.status_code in (200, 201)
    assert trip.json()["destination_nights"] == 2

    stop = client.post(
        f"/trips/{trip.json()['id']}/destinations/",
        headers=auth_headers,
        json={"location": "Hallstatt", "latitude": 47.56, "longitude": 13.65, "nights": 3},
    )
    assert stop.json()["nights"] == 3

    listed = client.get(
        f"/trips/{trip.json()['id']}/destinations/", headers=auth_headers
    ).json()
    assert listed[0]["nights"] == 3
