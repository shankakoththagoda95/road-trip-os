from dataclasses import dataclass
from enum import Enum


class DistanceStatus(str, Enum):
    WITHIN_LIMIT = "within_limit"
    WITHIN_TOLERANCE = "within_tolerance"
    EXCEEDS_LIMIT = "exceeds_limit"


class DrivingTimeStatus(str, Enum):
    WITHIN_LIMIT = "within_limit"
    EXCEEDS_LIMIT = "exceeds_limit"


@dataclass
class DrivingDay:
    day_number: int
    legs: list[dict]
    total_distance_meters: float
    total_duration_seconds: float
    distance_status: DistanceStatus
    driving_time_status: DrivingTimeStatus


TOLERANCE_PERCENT = 0.10


def check_distance_limit(
    distance_meters: float,
    max_distance_per_day: float | None,
) -> DistanceStatus:
    """
    Check a route distance against the preferred daily limit
    and its 10% tolerance.
    """

    if max_distance_per_day is None:
        return DistanceStatus.WITHIN_LIMIT

    preferred_limit_meters = max_distance_per_day * 1000

    maximum_acceptable_meters = (
        preferred_limit_meters
        * (1 + TOLERANCE_PERCENT)
    )

    if distance_meters <= preferred_limit_meters:
        return DistanceStatus.WITHIN_LIMIT

    if distance_meters <= maximum_acceptable_meters:
        return DistanceStatus.WITHIN_TOLERANCE

    return DistanceStatus.EXCEEDS_LIMIT


def check_driving_time_limit(
    duration_seconds: float,
    max_driving_hours_per_day: float | None,
) -> DrivingTimeStatus:
    """
    Check driving time against the preferred daily driving limit.
    """

    if max_driving_hours_per_day is None:
        return DrivingTimeStatus.WITHIN_LIMIT

    maximum_seconds = max_driving_hours_per_day * 3600

    if duration_seconds <= maximum_seconds:
        return DrivingTimeStatus.WITHIN_LIMIT

    return DrivingTimeStatus.EXCEEDS_LIMIT


def split_route_into_days(
    legs: list[dict],
    max_distance_per_day: float | None,
    max_driving_hours_per_day: float | None,
) -> list[DrivingDay]:
    """
    Split route legs into driving days based on distance
    and driving-time limits.
    """

    if (
        max_distance_per_day is None
        and max_driving_hours_per_day is None
    ):
        total_distance = sum(
            leg["distance_meters"]
            for leg in legs
        )

        total_duration = sum(
            leg["duration_seconds"]
            for leg in legs
        )

        return [
            DrivingDay(
                day_number=1,
                legs=legs,
                total_distance_meters=total_distance,
                total_duration_seconds=total_duration,
                distance_status=DistanceStatus.WITHIN_LIMIT,
                driving_time_status=DrivingTimeStatus.WITHIN_LIMIT,
            )
        ]

    preferred_limit_meters = (
        max_distance_per_day * 1000
        if max_distance_per_day is not None
        else None
    )

    maximum_acceptable_meters = (
        preferred_limit_meters * (1 + TOLERANCE_PERCENT)
        if preferred_limit_meters is not None
        else None
    )

    maximum_driving_seconds = (
        max_driving_hours_per_day * 3600
        if max_driving_hours_per_day is not None
        else None
    )

    days: list[DrivingDay] = []
    current_day: list[dict] = []
    current_distance = 0.0
    current_duration = 0.0

    for leg in legs:
        leg_distance = leg["distance_meters"]
        leg_duration = leg["duration_seconds"]

        if (
            maximum_driving_seconds is not None
            and leg_duration > maximum_driving_seconds
        ):
            raise ValueError(
                "Route leg exceeds the maximum acceptable daily driving time"
            )

        if (
            maximum_acceptable_meters is not None
            and leg_distance > maximum_acceptable_meters
        ):
            raise ValueError(
                "Route leg exceeds the maximum acceptable daily distance"
            )

        exceeds_distance = (
            maximum_acceptable_meters is not None
            and current_distance + leg_distance
            > maximum_acceptable_meters
        )

        exceeds_driving_time = (
            maximum_driving_seconds is not None
            and current_duration + leg_duration
            > maximum_driving_seconds
        )

        if current_day and (
            exceeds_distance or exceeds_driving_time
        ):
            days.append(
                DrivingDay(
                    day_number=len(days) + 1,
                    legs=current_day,
                    total_distance_meters=current_distance,
                    total_duration_seconds=current_duration,
                    distance_status=check_distance_limit(
                        current_distance,
                        max_distance_per_day,
                    ),
                    driving_time_status=check_driving_time_limit(
                        current_duration,
                        max_driving_hours_per_day,
                    ),
                )
            )

            current_day = []
            current_distance = 0.0
            current_duration = 0.0

        current_day.append(leg)
        current_distance += leg_distance
        current_duration += leg_duration

    if current_day:
        days.append(
            DrivingDay(
                day_number=len(days) + 1,
                legs=current_day,
                total_distance_meters=current_distance,
                total_duration_seconds=current_duration,
                distance_status=check_distance_limit(
                    current_distance,
                    max_distance_per_day,
                ),
                driving_time_status=check_driving_time_limit(
                    current_duration,
                    max_driving_hours_per_day,
                ),
            )
        )

    return days