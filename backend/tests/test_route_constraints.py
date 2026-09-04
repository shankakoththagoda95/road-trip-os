import pytest

from app.services.route_constraints import (
    DistanceStatus,
    DrivingTimeStatus,
    check_distance_limit,
    check_driving_time_limit,
    split_route_into_days,
)


def test_driving_time_within_limit():
    result = check_driving_time_limit(
        5 * 3600,
        6,
    )

    assert result == DrivingTimeStatus.WITHIN_LIMIT


def test_driving_time_exactly_at_limit():
    result = check_driving_time_limit(
        6 * 3600,
        6,
    )

    assert result == DrivingTimeStatus.WITHIN_LIMIT


def test_driving_time_exceeds_limit():
    result = check_driving_time_limit(
        7 * 3600,
        6,
    )

    assert result == DrivingTimeStatus.EXCEEDS_LIMIT


def test_route_splits_when_driving_time_limit_is_exceeded():
    legs = [
        {
            "distance_meters": 100_000,
            "duration_seconds": 3 * 3600,
        },
        {
            "distance_meters": 100_000,
            "duration_seconds": 4 * 3600,
        },
    ]

    days = split_route_into_days(
        legs,
        max_distance_per_day=500,
        max_driving_hours_per_day=6,
    )

    assert len(days) == 2
    assert days[0].total_duration_seconds == 3 * 3600
    assert days[1].total_duration_seconds == 4 * 3600
    assert days[0].driving_time_status == DrivingTimeStatus.WITHIN_LIMIT
    assert days[1].driving_time_status == DrivingTimeStatus.WITHIN_LIMIT


def test_route_leg_exceeds_driving_time_limit():
    legs = [
        {
            "distance_meters": 100_000,
            "duration_seconds": 7 * 3600,
        },
    ]

    with pytest.raises(
        ValueError,
        match="maximum acceptable daily driving time",
    ):
        split_route_into_days(
            legs,
            max_distance_per_day=500,
            max_driving_hours_per_day=6,
        )


def test_distance_within_limit():
    result = check_distance_limit(
        500_000,
        500,
    )

    assert result == DistanceStatus.WITHIN_LIMIT


def test_distance_within_tolerance():
    result = check_distance_limit(
        525_000,
        500,
    )

    assert result == DistanceStatus.WITHIN_TOLERANCE


def test_distance_exceeds_limit():
    result = check_distance_limit(
        600_000,
        500,
    )

    assert result == DistanceStatus.EXCEEDS_LIMIT


def test_route_splits_using_driving_time_without_distance_limit():
    legs = [
        {
            "distance_meters": 1_000_000,
            "duration_seconds": 3 * 3600,
        },
        {
            "distance_meters": 1_000_000,
            "duration_seconds": 4 * 3600,
        },
    ]

    days = split_route_into_days(
        legs,
        max_distance_per_day=None,
        max_driving_hours_per_day=6,
    )

    assert len(days) == 2
    assert days[0].total_duration_seconds == 3 * 3600
    assert days[1].total_duration_seconds == 4 * 3600


def test_route_splits_using_distance_without_driving_time_limit():
    legs = [
        {
            "distance_meters": 300_000,
            "duration_seconds": 2 * 3600,
        },
        {
            "distance_meters": 300_000,
            "duration_seconds": 2 * 3600,
        },
    ]

    days = split_route_into_days(
        legs,
        max_distance_per_day=500,
        max_driving_hours_per_day=None,
    )

    assert len(days) == 2
    assert days[0].total_distance_meters == 300_000
    assert days[1].total_distance_meters == 300_000


def test_route_splits_when_distance_limit_is_exceeded():
    legs = [
        {
            "distance_meters": 300_000,
            "duration_seconds": 2 * 3600,
        },
        {
            "distance_meters": 300_000,
            "duration_seconds": 2 * 3600,
        },
    ]

    days = split_route_into_days(
        legs,
        max_distance_per_day=500,
        max_driving_hours_per_day=8,
    )

    assert len(days) == 2
    assert days[0].total_distance_meters == 300_000
    assert days[1].total_distance_meters == 300_000