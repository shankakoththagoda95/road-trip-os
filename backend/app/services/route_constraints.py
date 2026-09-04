from enum import Enum


class DistanceStatus(str, Enum):
    WITHIN_LIMIT = "within_limit"
    WITHIN_TOLERANCE = "within_tolerance"
    EXCEEDS_LIMIT = "exceeds_limit"


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