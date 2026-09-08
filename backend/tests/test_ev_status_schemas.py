from app.schemas.ev_status import TripEVStatusResponse


def test_valid_trip_ev_status_response():
    status = TripEVStatusResponse(
        trip_id=1,
        battery_percentage=80,
        available_range_km=300,
        usable_range_km=240,
        route_distance_km=250,
        needs_charging=True,
        range_shortfall_km=10,
    )

    assert status.trip_id == 1
    assert status.battery_percentage == 80
    assert status.available_range_km == 300
    assert status.usable_range_km == 240
    assert status.route_distance_km == 250
    assert status.needs_charging is True
    assert status.range_shortfall_km == 10


def test_trip_ev_status_response_without_charging():
    status = TripEVStatusResponse(
        trip_id=1,
        battery_percentage=90,
        available_range_km=337.5,
        usable_range_km=270,
        route_distance_km=250,
        needs_charging=False,
        range_shortfall_km=0,
    )

    assert status.needs_charging is False
    assert status.range_shortfall_km == 0