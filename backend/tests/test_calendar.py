import pytest

from datetime import datetime

from app.services.calendar import generate_itinerary_calendar_events


def test_generate_itinerary_calendar_events():
    class FakeDay:
        def __init__(
            self,
            day_number,
            total_distance_meters,
            total_duration_seconds,
        ):
            self.day_number = day_number
            self.total_distance_meters = total_distance_meters
            self.total_duration_seconds = total_duration_seconds

    departure_at = datetime(2026, 10, 1, 8, 0)

    days = [
        FakeDay(
            day_number=1,
            total_distance_meters=450000,
            total_duration_seconds=14400,
        ),
        FakeDay(
            day_number=2,
            total_distance_meters=450000,
            total_duration_seconds=14400,
        ),
    ]

    events = generate_itinerary_calendar_events(
        departure_at=departure_at,
        days=days,
    )

    assert len(events) == 2

    assert events[0].title == "Road Trip — Day 1"
    assert events[0].start_at == datetime(2026, 10, 1, 8, 0)
    assert events[0].end_at == datetime(2026, 10, 1, 12, 0)

    assert events[1].title == "Road Trip — Day 2"
    assert events[1].start_at == datetime(2026, 10, 2, 8, 0)
    assert events[1].end_at == datetime(2026, 10, 2, 12, 0)


def test_generate_itinerary_calendar_events_with_no_days():
    departure_at = datetime(2026, 10, 1, 8, 0)

    events = generate_itinerary_calendar_events(
        departure_at=departure_at,
        days=[],
    )

    assert events == []


def test_generate_itinerary_calendar_event_description():
    class FakeDay:
        day_number = 1
        total_distance_meters = 450000
        total_duration_seconds = 14400

    departure_at = datetime(2026, 10, 1, 8, 0)

    events = generate_itinerary_calendar_events(
        departure_at=departure_at,
        days=[FakeDay()],
    )

    assert events[0].description == (
        "Distance: 450000 meters\n"
        "Driving time: 14400 seconds"
    )


def test_calendar_event_rejects_empty_title():
    from app.services.calendar import CalendarEvent

    with pytest.raises(
        ValueError,
        match="Calendar event title cannot be empty",
    ):
        CalendarEvent(
            title="   ",
            start_at=datetime(2026, 10, 1, 8, 0),
            end_at=datetime(2026, 10, 1, 12, 0),
            description="Road trip",
        )


def test_calendar_event_rejects_empty_description():
    from app.services.calendar import CalendarEvent

    with pytest.raises(
        ValueError,
        match="Calendar event description cannot be empty",
    ):
        CalendarEvent(
            title="Road Trip",
            start_at=datetime(2026, 10, 1, 8, 0),
            end_at=datetime(2026, 10, 1, 12, 0),
            description="   ",
        )


def test_calendar_event_rejects_end_before_start():
    from app.services.calendar import CalendarEvent

    with pytest.raises(
        ValueError,
        match="Calendar event must end after it starts",
    ):
        CalendarEvent(
            title="Road Trip",
            start_at=datetime(2026, 10, 1, 12, 0),
            end_at=datetime(2026, 10, 1, 8, 0),
            description="Road trip",
        )


def test_generate_trip_calendar_events_uses_trip_departure():
    from app.services.calendar import generate_trip_calendar_events

    class FakeTrip:
        departure_at = datetime(2026, 10, 1, 8, 0)

    class FakeDay:
        day_number = 1
        total_distance_meters = 450000
        total_duration_seconds = 14400

    events = generate_trip_calendar_events(
        trip=FakeTrip(),
        days=[FakeDay()],
    )

    assert len(events) == 1
    assert events[0].title == "Road Trip — Day 1"
    assert events[0].start_at == datetime(2026, 10, 1, 8, 0)
    assert events[0].end_at == datetime(2026, 10, 1, 12, 0)


def test_escape_ical_text():
    from app.services.calendar import escape_ical_text

    value = "Road Trip, Day 1; Sweden\nDriving"

    assert escape_ical_text(value) == (
        "Road Trip\\, Day 1\\; Sweden\\nDriving"
    )


def test_escape_ical_text_escapes_backslashes():
    from app.services.calendar import escape_ical_text

    assert escape_ical_text(r"Road\Trip") == r"Road\\Trip"


def test_generate_ical_event():
    from app.services.calendar import CalendarEvent, generate_ical_event

    event = CalendarEvent(
        title="Road Trip — Day 1",
        start_at=datetime(2026, 10, 1, 8, 0),
        end_at=datetime(2026, 10, 1, 12, 0),
        description="Distance: 450000 meters",
    )

    result = generate_ical_event(event)

    assert "BEGIN:VCALENDAR" in result
    assert "VERSION:2.0" in result
    assert "PRODID:-//Road-Trip OS//Calendar//EN" in result
    assert "BEGIN:VEVENT" in result
    assert "SUMMARY:Road Trip — Day 1" in result
    assert "DTSTART:20261001T080000" in result
    assert "DTEND:20261001T120000" in result
    assert "DESCRIPTION:Distance: 450000 meters" in result
    assert "END:VEVENT" in result
    assert "END:VCALENDAR" in result


def test_generate_ical_calendar_with_multiple_events():
    from app.services.calendar import (
        CalendarEvent,
        generate_ical_calendar,
    )

    events = [
        CalendarEvent(
            title="Road Trip — Day 1",
            start_at=datetime(2026, 10, 1, 8, 0),
            end_at=datetime(2026, 10, 1, 12, 0),
            description="Day 1",
        ),
        CalendarEvent(
            title="Road Trip — Day 2",
            start_at=datetime(2026, 10, 2, 8, 0),
            end_at=datetime(2026, 10, 2, 12, 0),
            description="Day 2",
        ),
    ]

    result = generate_ical_calendar(events)

    assert result.count("BEGIN:VEVENT") == 2
    assert result.count("END:VEVENT") == 2

    assert "SUMMARY:Road Trip — Day 1" in result
    assert "SUMMARY:Road Trip — Day 2" in result

    assert "DTSTART:20261001T080000" in result
    assert "DTSTART:20261002T080000" in result

    assert result.startswith("BEGIN:VCALENDAR")
    assert result.endswith("END:VCALENDAR")


def test_generate_ical_calendar_escapes_event_text():
    from app.services.calendar import (
        CalendarEvent,
        generate_ical_calendar,
    )

    event = CalendarEvent(
        title="Road Trip, Day 1; Sweden",
        start_at=datetime(2026, 10, 1, 8, 0),
        end_at=datetime(2026, 10, 1, 12, 0),
        description="Stockholm, Sweden\nDriving route",
    )

    result = generate_ical_calendar([event])

    assert "SUMMARY:Road Trip\\, Day 1\\; Sweden" in result
    assert (
        "DESCRIPTION:Stockholm\\, Sweden\\nDriving route"
        in result
    )


def test_generate_trip_ical_calendar():
    from app.services.calendar import generate_trip_ical_calendar

    class FakeTrip:
        departure_at = datetime(2026, 10, 1, 8, 0)

    class FakeDay:
        day_number = 1
        total_distance_meters = 450000
        total_duration_seconds = 14400

    result = generate_trip_ical_calendar(
        trip=FakeTrip(),
        days=[FakeDay()],
    )

    assert "BEGIN:VCALENDAR" in result
    assert "BEGIN:VEVENT" in result
    assert "SUMMARY:Road Trip — Day 1" in result
    assert "DTSTART:20261001T080000" in result
    assert "DTEND:20261001T120000" in result
    assert "END:VEVENT" in result
    assert "END:VCALENDAR" in result