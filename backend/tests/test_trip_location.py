from datetime import datetime

from app.models.trip_location import TripLocation


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