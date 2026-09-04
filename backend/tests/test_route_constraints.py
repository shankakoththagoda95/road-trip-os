from app.services.route_constraints import (
    DrivingTimeStatus,
    check_driving_time_limit,
)


def test_driving_time_within_limit():
    result = check_driving_time_limit(
        5 * 3600,
        6,
    )

    assert result == DrivingTimeStatus.WITHIN_LIMIT