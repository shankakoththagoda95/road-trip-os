from enum import Enum
from dataclasses import dataclass


class DistanceStatus(str, Enum):
    WITHIN_LIMIT = "within_limit"
    WITHIN_TOLERANCE = "within_tolerance"
    EXCEEDS_LIMIT = "exceeds_limit"


@dataclass
class DrivingDay:
    day_number: int
    legs: list[dict]
    total_distance_meters: float
    distance_status: DistanceStatus


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


def split_route_into_days(
    legs: list[dict],
    max_distance_per_day: float | None,
) -> list[DrivingDay]:
    """
    Split route legs into driving days based on the
    preferred daily distance and 10% tolerance.
    """

    if max_distance_per_day is None:
        return [legs]

    preferred_limit_meters = max_distance_per_day * 1000

    maximum_acceptable_meters = (
        preferred_limit_meters
        * (1 + TOLERANCE_PERCENT)
    )

    days: list[DrivingDay] = []
    current_day: list[dict] = []
    current_distance = 0.0

    for leg in legs:
        leg_distance = leg["distance_meters"]
        if leg_distance > maximum_acceptable_meters:
            raise ValueError(
                "Route leg exceeds the maximum acceptable daily distance"
            )

        if (
            current_day
            and current_distance + leg_distance
            > maximum_acceptable_meters
        ):
            days.append(
                DrivingDay(
                    day_number=len(days) + 1,
                    legs=current_day,
                    total_distance_meters=current_distance,
                    distance_status=check_distance_limit(
                        current_distance,
                        max_distance_per_day,
                    ),
                )
            )

            current_day = []
            current_distance = 0.0

        current_day.append(leg)
        current_distance += leg_distance

    if current_day:
        days.append(
            DrivingDay(
                day_number=len(days) + 1,
                legs=current_day,
                total_distance_meters=current_distance,
                distance_status=check_distance_limit(
                    current_distance,
                    max_distance_per_day,
                ),
            )
        )

    return days