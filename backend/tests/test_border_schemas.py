from app.schemas.borders import (
    BorderCalculationResponse,
    BorderCrossingResponse,
)


def test_border_crossing_response():
    response = BorderCrossingResponse(
        from_country="Sweden",
        to_country="Denmark",
        location=(55.6761, 12.5683),
    )

    assert response.from_country == "Sweden"
    assert response.to_country == "Denmark"
    assert response.location == (55.6761, 12.5683)


def test_border_crossing_response_allows_no_location():
    response = BorderCrossingResponse(
        from_country="Sweden",
        to_country="Denmark",
        location=None,
    )

    assert response.location is None


def test_border_calculation_response():
    response = BorderCalculationResponse(
        trip_id=1,
        crossings=[
            BorderCrossingResponse(
                from_country="Sweden",
                to_country="Denmark",
                location=None,
            ),
            BorderCrossingResponse(
                from_country="Denmark",
                to_country="Germany",
                location=None,
            ),
        ],
        countries=["Sweden", "Denmark", "Germany"],
    )

    assert response.trip_id == 1
    assert len(response.crossings) == 2
    assert response.countries == [
        "Sweden",
        "Denmark",
        "Germany",
    ]