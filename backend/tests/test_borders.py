import pytest

from app.services.borders import (
    BorderCrossing,
    BorderProvider,
    detect_border_crossings,
    calculate_route_borders,
)


def test_border_crossing_stores_country_information():
    crossing = BorderCrossing(
        from_country="Sweden",
        to_country="Denmark",
        location=(55.6761, 12.5683),
    )

    assert crossing.from_country == "Sweden"
    assert crossing.to_country == "Denmark"
    assert crossing.location == (55.6761, 12.5683)


def test_border_crossing_rejects_empty_from_country():
    with pytest.raises(ValueError, match="From country cannot be empty"):
        BorderCrossing(
            from_country="",
            to_country="Denmark",
            location=(55.6761, 12.5683),
        )


def test_border_crossing_rejects_empty_to_country():
    with pytest.raises(ValueError, match="To country cannot be empty"):
        BorderCrossing(
            from_country="Sweden",
            to_country="",
            location=(55.6761, 12.5683),
        )


def test_border_crossing_rejects_invalid_latitude():
    with pytest.raises(ValueError, match="Invalid latitude"):
        BorderCrossing(
            from_country="Sweden",
            to_country="Denmark",
            location=(91.0, 12.5683),
        )


def test_border_crossing_rejects_invalid_longitude():
    with pytest.raises(ValueError, match="Invalid longitude"):
        BorderCrossing(
            from_country="Sweden",
            to_country="Denmark",
            location=(55.6761, 181.0),
        )


def test_detect_border_crossings():
    crossings = detect_border_crossings(
        ["Sweden", "Sweden", "Denmark", "Germany"]
    )

    assert len(crossings) == 2

    assert crossings[0].from_country == "Sweden"
    assert crossings[0].to_country == "Denmark"

    assert crossings[1].from_country == "Denmark"
    assert crossings[1].to_country == "Germany"


def test_detect_border_crossings_returns_empty_for_same_country():
    crossings = detect_border_crossings(
        ["Sweden", "Sweden", "Sweden"]
    )

    assert crossings == []


def test_detect_border_crossings_returns_empty_for_empty_route():
    crossings = detect_border_crossings([])

    assert crossings == []


def test_detect_border_crossings_rejects_empty_country():
    with pytest.raises(ValueError, match="Country cannot be empty"):
        detect_border_crossings(
            ["Sweden", "", "Germany"]
        )


def test_border_provider_returns_countries():
    class FakeBorderProvider(BorderProvider):
        def get_countries(
            self,
            route_coordinates: list[tuple[float, float]],
        ) -> list[str]:
            return ["Sweden", "Denmark", "Germany"]

    provider = FakeBorderProvider()

    countries = provider.get_countries(
        [(59.3293, 18.0686), (55.6761, 12.5683)]
    )

    assert countries == ["Sweden", "Denmark", "Germany"]


def test_calculate_route_borders_uses_provider():
    class FakeBorderProvider(BorderProvider):
        def get_countries(
            self,
            route_coordinates: list[tuple[float, float]],
        ) -> list[str]:
            assert route_coordinates == [
                (59.3293, 18.0686),
                (55.6761, 12.5683),
            ]
            return ["Sweden", "Denmark"]

    provider = FakeBorderProvider()

    crossings = calculate_route_borders(
        route_coordinates=[
            (59.3293, 18.0686),
            (55.6761, 12.5683),
        ],
        provider=provider,
    )

    assert crossings.countries == ["Sweden", "Denmark"]

    assert len(crossings.crossings) == 1
    assert crossings.crossings[0].from_country == "Sweden"
    assert crossings.crossings[0].to_country == "Denmark"


def test_calculate_route_borders_rejects_invalid_coordinates():
    provider = BorderProvider()

    with pytest.raises(ValueError, match="Invalid latitude"):
        calculate_route_borders(
            route_coordinates=[(91.0, 18.0686)],
            provider=provider,
        )

    with pytest.raises(ValueError, match="Invalid longitude"):
        calculate_route_borders(
            route_coordinates=[(59.3293, 181.0)],
            provider=provider,
        )


def test_border_crossing_can_have_no_location():
    crossing = BorderCrossing(
        from_country="Sweden",
        to_country="Denmark",
    )

    assert crossing.location is None