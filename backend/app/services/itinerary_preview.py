from datetime import datetime, timedelta

from app.services.itinerary import schedule_driving_days
from app.services.route_constraints import TOLERANCE_PERCENT


def _format_hours(seconds: float) -> str:
    minutes = round(seconds / 60)
    hours, minutes = divmod(minutes, 60)

    return f"{hours} h {minutes} min" if minutes else f"{hours} h"


def legs_over_limit(
    legs: list[dict],
    max_distance_per_day: float | None,
    max_driving_hours_per_day: float | None,
) -> list[str]:
    """
    Explain which legs are too long for one day. Days are only split at
    stops, so these need an extra stop (or a higher limit).
    """

    problems = []

    for leg in legs:
        route = f"{leg['from_location']} → {leg['to_location']}"

        if (
            max_driving_hours_per_day is not None
            and leg["duration_seconds"] > max_driving_hours_per_day * 3600
        ):
            problems.append(
                f"{route} takes {_format_hours(leg['duration_seconds'])}, "
                f"more than your {max_driving_hours_per_day:g} h daily limit. "
                "Add a stop in between or raise the limit."
            )
        elif (
            max_distance_per_day is not None
            and leg["distance_meters"]
            > max_distance_per_day * 1000 * (1 + TOLERANCE_PERCENT)
        ):
            problems.append(
                f"{route} is {round(leg['distance_meters'] / 1000)} km, more "
                f"than your {max_distance_per_day:g} km daily limit. "
                "Add a stop in between or raise the limit."
            )

    return problems


def preview_itinerary(
    route: dict,
    trip_type: str,
    departure_at: datetime,
    duration_days: int,
    max_distance_per_day: float | None,
    max_driving_hours_per_day: float | None,
    stay_nights: list[int] | None = None,
) -> dict:
    """
    Day-by-day plan for a route preview (see services/route_preview.py):
    every trip day, driving or free.
    """

    legs = route["legs"]
    problems = legs_over_limit(
        legs,
        max_distance_per_day,
        max_driving_hours_per_day,
    )

    if problems:
        return {
            "distance_meters": route["distance_meters"],
            "duration_seconds": route["duration_seconds"],
            "days": [],
            "driving_days": 0,
            "problems": problems,
        }

    driving, warnings = schedule_driving_days(
        legs,
        trip_type,
        duration_days,
        max_distance_per_day,
        max_driving_hours_per_day,
        stay_nights=stay_nights,
    )
    by_number = {day.day_number: day for day in driving}
    last_day = max(duration_days, max(by_number, default=1))

    days = []
    location = legs[0]["from_location"]

    for day_number in range(1, last_day + 1):
        day = by_number.get(day_number)
        day_date = departure_at.date() + timedelta(days=day_number - 1)

        if day is None:
            days.append(
                {
                    "day_number": day_number,
                    "date": day_date,
                    "driving": False,
                    "from_location": location,
                    "to_location": location,
                    "distance_meters": 0,
                    "duration_seconds": 0,
                    "distance_status": None,
                    "driving_time_status": None,
                    "legs": [],
                }
            )
            continue

        days.append(
            {
                "day_number": day_number,
                "date": day_date,
                "driving": True,
                "from_location": day.legs[0]["from_location"],
                "to_location": day.legs[-1]["to_location"],
                "distance_meters": day.total_distance_meters,
                "duration_seconds": day.total_duration_seconds,
                "distance_status": day.distance_status,
                "driving_time_status": day.driving_time_status,
                "legs": day.legs,
            }
        )
        location = day.legs[-1]["to_location"]

    return {
        "distance_meters": route["distance_meters"],
        "duration_seconds": route["duration_seconds"],
        "days": days,
        "driving_days": len(driving),
        "problems": warnings,
    }
