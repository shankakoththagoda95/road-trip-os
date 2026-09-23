import pytest
from datetime import datetime
from unittest.mock import patch

from app.models.trip import Trip
from app.schemas.route import RoutePreference
from app.schemas.trip import TripType
from app.services.borders import BorderProvider
from app.services.trip_route import calculate_trip_travel_checklist
from app.services.travel_checklist import (
    TravelChecklist,
    TravelChecklistItem,
    generate_travel_checklist,
)


def test_travel_checklist_item_stores_information():
    item = TravelChecklistItem(
        name="Passport",
        required=True,
        description="Valid passport required for international travel.",
    )

    assert item.name == "Passport"
    assert item.required is True
    assert item.description == (
        "Valid passport required for international travel."
    )


def test_travel_checklist_item_can_be_optional():
    item = TravelChecklistItem(
        name="International Driving Permit",
        required=False,
        description="May be required depending on the destination.",
    )

    assert item.required is False


def test_travel_checklist_item_rejects_empty_name():
    with pytest.raises(
        ValueError,
        match="Checklist item name cannot be empty",
    ):
        TravelChecklistItem(
            name="",
            required=True,
            description="Valid passport required.",
        )


def test_travel_checklist_item_rejects_empty_description():
    with pytest.raises(
        ValueError,
        match="Checklist item description cannot be empty",
    ):
        TravelChecklistItem(
            name="Passport",
            required=True,
            description="",
        )


def test_travel_checklist_separates_required_items():
    checklist = TravelChecklist(
        items=[
            TravelChecklistItem(
                name="Passport",
                required=True,
                description="Valid passport required.",
            ),
            TravelChecklistItem(
                name="Travel Insurance",
                required=False,
                description="Recommended for the trip.",
            ),
        ]
    )

    assert len(checklist.required_items) == 1
    assert checklist.required_items[0].name == "Passport"


def test_travel_checklist_separates_optional_items():
    checklist = TravelChecklist(
        items=[
            TravelChecklistItem(
                name="Passport",
                required=True,
                description="Valid passport required.",
            ),
            TravelChecklistItem(
                name="Travel Insurance",
                required=False,
                description="Recommended for the trip.",
            ),
        ]
    )

    assert len(checklist.optional_items) == 1
    assert checklist.optional_items[0].name == "Travel Insurance"


def test_travel_checklist_can_be_empty():
    checklist = TravelChecklist(items=[])

    assert checklist.items == []
    assert checklist.required_items == []
    assert checklist.optional_items == []


def test_generate_travel_checklist_for_international_trip():
    checklist = generate_travel_checklist(
        ["Sweden", "Denmark"]
    )

    assert len(checklist.items) == 2

    assert checklist.items[0].name == "Passport"
    assert checklist.items[0].required is True

    assert checklist.items[1].name == "Travel Insurance"
    assert checklist.items[1].required is False


def test_generate_travel_checklist_for_single_country_trip():
    checklist = generate_travel_checklist(
        ["Sweden"]
    )

    assert checklist.items == []


def test_generate_travel_checklist_for_empty_country_list():
    checklist = generate_travel_checklist([])

    assert checklist.items == []


def test_generate_travel_checklist_rejects_empty_country():
    with pytest.raises(
        ValueError,
        match="Country cannot be empty",
    ):
        generate_travel_checklist(
            ["Sweden", "", "Denmark"]
        )


def test_calculate_trip_travel_checklist_uses_border_countries():
    class FakeBorderProvider(BorderProvider):
        def get_countries(self, route_coordinates):
            return ["Sweden", "Denmark"]

    provider = FakeBorderProvider()

    trip = Trip(
        user_id=1,
        name="Scandinavian Road Trip",
        start_location="Stockholm",
        destination="Copenhagen",
        trip_type=TripType.ONE_WAY,
        departure_at=datetime.now(),
        travelers=1,
        duration_days=1,
    )

    fake_route_details = {
        "route": {
            "geometry": {
                "coordinates": [
                    [18.0686, 59.3293],
                    [12.5683, 55.6761],
                ],
            }
        }
    }

    with patch(
        "app.services.trip_route.calculate_trip_route_details",
        return_value=fake_route_details,
    ):
        result = calculate_trip_travel_checklist(
            trip=trip,
            destinations=[],
            preference=RoutePreference.FASTEST,
            provider=provider,
        )

    assert len(result.items) == 2
    assert result.items[0].name == "Passport"
    assert result.items[0].required is True
    assert result.items[1].name == "Travel Insurance"
    assert result.items[1].required is False


def test_calculate_trip_travel_checklist_for_single_country():
    class FakeBorderProvider(BorderProvider):
        def get_countries(self, route_coordinates):
            return ["Sweden"]

    provider = FakeBorderProvider()

    trip = Trip(
        user_id=1,
        name="Sweden Road Trip",
        start_location="Stockholm",
        destination="Gothenburg",
        trip_type=TripType.ONE_WAY,
        departure_at=datetime.now(),
        travelers=1,
        duration_days=1,
    )

    fake_route_details = {
        "route": {
            "geometry": {
                "coordinates": [
                    [18.0686, 59.3293],
                    [11.9746, 57.7089],
                ],
            }
        }
    }

    with patch(
        "app.services.trip_route.calculate_trip_route_details",
        return_value=fake_route_details,
    ):
        result = calculate_trip_travel_checklist(
            trip=trip,
            destinations=[],
            preference=RoutePreference.FASTEST,
            provider=provider,
        )

    assert result.items == []