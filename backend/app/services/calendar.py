from dataclasses import dataclass
from datetime import datetime, timedelta
from app.models.itinerary_day import ItineraryDay
from app.models.trip import Trip


@dataclass
class CalendarEvent:
    title: str
    start_at: datetime
    end_at: datetime
    description: str

    def __post_init__(self) -> None:
        if not self.title.strip():
            raise ValueError("Calendar event title cannot be empty")

        if not self.description.strip():
            raise ValueError("Calendar event description cannot be empty")

        if self.end_at <= self.start_at:
            raise ValueError("Calendar event must end after it starts")


def generate_itinerary_calendar_events(
    departure_at: datetime,
    days: list,
) -> list[CalendarEvent]:
    events: list[CalendarEvent] = []

    for day in days:
        start_at = departure_at + timedelta(
            days=day.day_number - 1,
        )

        end_at = start_at + timedelta(
            seconds=day.total_duration_seconds,
        )

        events.append(
            CalendarEvent(
                title=f"Road Trip — Day {day.day_number}",
                start_at=start_at,
                end_at=end_at,
                description=(
                    f"Distance: "
                    f"{day.total_distance_meters} meters\n"
                    f"Driving time: "
                    f"{day.total_duration_seconds} seconds"
                ),
            )
        )

    return events


def generate_trip_calendar_events(
    trip: Trip,
    days: list[ItineraryDay],
) -> list[CalendarEvent]:
    return generate_itinerary_calendar_events(
        departure_at=trip.departure_at,
        days=days,
    )


def escape_ical_text(value: str) -> str:
    return (
        value
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def generate_ical_event(event: CalendarEvent) -> str:
    start_at = event.start_at.strftime("%Y%m%dT%H%M%S")
    end_at = event.end_at.strftime("%Y%m%dT%H%M%S")

    return "\n".join(
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Road-Trip OS//Calendar//EN",
            "BEGIN:VEVENT",
            f"SUMMARY:{escape_ical_text(event.title)}",
            f"DTSTART:{start_at}",
            f"DTEND:{end_at}",
            f"DESCRIPTION:{escape_ical_text(event.description)}",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
    )


def generate_ical_calendar(events: list[CalendarEvent]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Road-Trip OS//Calendar//EN",
    ]

    for event in events:
        start_at = event.start_at.strftime("%Y%m%dT%H%M%S")
        end_at = event.end_at.strftime("%Y%m%dT%H%M%S")

        lines.extend(
            [
                "BEGIN:VEVENT",
                f"SUMMARY:{escape_ical_text(event.title)}",
                f"DTSTART:{start_at}",
                f"DTEND:{end_at}",
                f"DESCRIPTION:{escape_ical_text(event.description)}",
                "END:VEVENT",
            ]
        )

    lines.append("END:VCALENDAR")

    return "\n".join(lines)


def generate_trip_ical_calendar(
    trip: Trip,
    days: list[ItineraryDay],
) -> str:
    events = generate_trip_calendar_events(
        trip=trip,
        days=days,
    )

    return generate_ical_calendar(events)