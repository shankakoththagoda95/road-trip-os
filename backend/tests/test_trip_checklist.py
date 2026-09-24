from datetime import date

import pytest

from app.core.security import create_access_token
from app.services.trip_checklist import build_trip_checklist, trip_months


def ids(items):
    return [item.id for item in items]


def by_id(items, item_id):
    return next(item for item in items if item.id == item_id)


def test_domestic_trip_has_basic_documents_only():
    items = build_trip_checklist(["SE"], date(2026, 7, 1), 3)

    assert ids(items)[:3] == [
        "driving-licence",
        "vehicle-registration",
        "insurance-certificate",
    ]
    assert "passport-or-id" not in ids(items)
    assert "country-identifier" not in ids(items)
    # Sweden requires daytime headlights.
    assert "daytime-headlights" in ids(items)


def test_international_trip_needs_passport():
    items = build_trip_checklist(["SE", "NO"], date(2026, 7, 1), 3)

    assert by_id(items, "passport-or-id").required
    assert not by_id(items, "international-driving-permit").required


def test_vignettes_are_required_per_country():
    items = build_trip_checklist(["DE", "AT", "CH", "IT"], date(2026, 7, 1), 5)

    assert by_id(items, "vignette-at").required
    assert by_id(items, "vignette-ch").country_codes == ["CH"]
    assert by_id(items, "toll-payment").country_codes == ["IT"]
    assert "vignette-de" not in ids(items)


def test_equipment_lists_countries_that_require_it():
    items = build_trip_checklist(["DE", "AT", "IT"], date(2026, 7, 1), 5)

    first_aid = by_id(items, "first-aid-kit")

    assert first_aid.country_codes == ["DE", "AT"]
    assert "Required in DE, AT." in first_aid.description
    assert "fire-extinguisher" not in ids(items)


def test_winter_items_only_in_winter():
    summer = build_trip_checklist(["AT"], date(2026, 7, 1), 5)
    winter = build_trip_checklist(["AT"], date(2027, 1, 10), 5)

    assert "winter-tyres" not in ids(summer)
    assert "snow-chains" not in ids(summer)
    assert by_id(winter, "winter-tyres").required
    assert "snow-chains" in ids(winter)
    assert "winter-kit" in ids(winter)


def test_trip_spanning_into_winter_counts():
    # 28 Nov + 5 days reaches December: Sweden's winter tyre period.
    items = build_trip_checklist(["SE"], date(2026, 11, 28), 5)

    assert by_id(items, "winter-tyres").country_codes == ["SE"]


def test_trip_months():
    assert trip_months(date(2026, 1, 30), 3) == {1, 2}


def test_green_card_for_non_eu_countries():
    items = build_trip_checklist(["HR", "BA", "ME"], date(2026, 7, 1), 7)

    assert by_id(items, "green-card").country_codes == ["BA", "ME"]
    assert "green-card" not in ids(
        build_trip_checklist(["FR", "ES"], date(2026, 7, 1), 7)
    )


def test_vehicle_specific_items():
    ev = build_trip_checklist(["DE"], date(2026, 7, 1), 2, "car", "electric")
    campervan = build_trip_checklist(["DE"], date(2026, 7, 1), 2, "campervan", "diesel")

    assert "charging-cards" in ids(ev)
    assert "charging-cards" not in ids(campervan)
    assert "vehicle-weight" in ids(campervan)


def test_items_are_grouped_by_category():
    items = build_trip_checklist(
        ["DE", "AT", "CH", "IT"],
        date(2027, 1, 10),
        5,
        "car",
        "electric",
    )
    order = ["documents", "payments", "equipment", "winter", "rules", "vehicle"]
    categories = [item.category for item in items]

    assert categories == sorted(categories, key=order.index)


def test_ids_are_unique():
    items = build_trip_checklist(
        ["FR", "DE", "AT", "CH", "IT", "SI", "HR", "BA"],
        date(2027, 1, 10),
        14,
        "campervan",
        "plug_in_hybrid",
    )

    assert len(ids(items)) == len(set(ids(items)))


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


def test_checklist_endpoint(client, auth_headers):
    response = client.post(
        "/checklists/",
        json={
            "country_codes": ["se", "NO"],
            "departure_date": "2026-12-20",
            "duration_days": 4,
            "fuel_type": "electric",
        },
        headers=auth_headers,
    )

    assert response.status_code == 200

    items = response.json()["items"]
    item_ids = [item["id"] for item in items]

    assert "passport-or-id" in item_ids
    assert "winter-tyres" in item_ids
    assert "charging-cards" in item_ids


def test_checklist_endpoint_validates_country_codes(client, auth_headers):
    response = client.post(
        "/checklists/",
        json={
            "country_codes": ["Sweden"],
            "departure_date": "2026-12-20",
            "duration_days": 4,
        },
        headers=auth_headers,
    )

    assert response.status_code == 422
