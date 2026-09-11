from datetime import datetime
from unittest.mock import patch

import pytest
from app.services.tolls import (
    TollCalculation,
    TollFee,
    TollProvider,
    calculate_route_tolls,
    calculate_toll_total,
)
from app.models.trip import Trip
from app.models.trip_destination import TripDestination
from app.schemas.route import RoutePreference
from app.schemas.trip import TripType
from app.services.trip_route import calculate_trip_route_tolls


def test_calculate_toll_total():
    fees = [
        TollFee(
            name="Bridge Toll",
            country="Denmark",
            amount=5.0,
            currency="EUR",
        ),
        TollFee(
            name="Tunnel Toll",
            country="Sweden",
            amount=8.0,
            currency="EUR",
        ),
        TollFee(
            name="Motorway Toll",
            country="Germany",
            amount=12.0,
            currency="EUR",
        ),
    ]

    total = calculate_toll_total(fees)

    assert total == 25.0


def test_calculate_toll_total_with_no_fees():
    fees = []

    total = calculate_toll_total(fees)

    assert total == 0.0


from app.services.tolls import TollFee


def test_toll_fee_contains_basic_information():
    fee = TollFee(
        name="Bridge Toll",
        country="Denmark",
        amount=50.0,
        currency="EUR",
    )

    assert fee.name == "Bridge Toll"
    assert fee.country == "Denmark"
    assert fee.amount == 50.0
    assert fee.currency == "EUR"


def test_toll_fee_rejects_negative_amount():
    with pytest.raises(ValueError, match="Toll amount cannot be negative"):
        TollFee(
            name="Bridge Toll",
            country="Denmark",
            amount=-5.0,
            currency="EUR",
        )


def test_toll_fee_rejects_empty_currency():
    with pytest.raises(ValueError, match="Currency cannot be empty"):
        TollFee(
            name="Bridge Toll",
            country="Denmark",
            amount=5.0,
            currency="",
        )


def test_toll_fee_rejects_empty_name():
    with pytest.raises(ValueError, match="Toll name cannot be empty"):
        TollFee(
            name="",
            country="Denmark",
            amount=5.0,
            currency="EUR",
        )


def test_toll_fee_rejects_empty_country():
    with pytest.raises(ValueError, match="Country cannot be empty"):
        TollFee(
            name="Bridge Toll",
            country="",
            amount=5.0,
            currency="EUR",
        )


def test_toll_calculation_contains_fees_and_total():
    fees = [
        TollFee(
            name="Bridge Toll",
            country="Denmark",
            amount=5.0,
            currency="EUR",
        ),
        TollFee(
            name="Tunnel Toll",
            country="Sweden",
            amount=8.0,
            currency="EUR",
        ),
    ]

    calculation = TollCalculation(
        fees=fees,
        currency="EUR",
    )

    assert calculation.fees == fees
    assert calculation.total_amount == 13.0
    assert calculation.currency == "EUR"


def test_toll_fee_rejects_negative_amount():
    with pytest.raises(ValueError, match="Toll amount cannot be negative"):
        TollFee(
            name="Bridge Toll",
            country="Denmark",
            amount=-5.0,
            currency="EUR",
        )


def test_toll_calculation_calculates_total_from_fees():
    fees = [
        TollFee(
            name="Bridge Toll",
            country="Denmark",
            amount=5.0,
            currency="EUR",
        ),
        TollFee(
            name="Tunnel Toll",
            country="Sweden",
            amount=8.0,
            currency="EUR",
        ),
    ]

    calculation = TollCalculation(
        fees=fees,
        currency="EUR",
    )

    assert calculation.total_amount == 13.0


def test_toll_calculation_rejects_mixed_currencies():
    fees = [
        TollFee(
            name="Bridge Toll",
            country="Denmark",
            amount=5.0,
            currency="EUR",
        ),
        TollFee(
            name="Tunnel Toll",
            country="Sweden",
            amount=8.0,
            currency="SEK",
        ),
    ]

    with pytest.raises(
        ValueError,
        match="All toll fees must use the same currency",
    ):
        TollCalculation(
            fees=fees,
            currency="EUR",
        )


def test_toll_provider_defines_toll_lookup():
    provider = TollProvider()

    fees = provider.get_tolls(
        [
            (55.6761, 12.5683),
            (55.4038, 10.4024),
        ]
    )

    assert fees == []


def test_toll_provider_can_return_toll_fees():
    class FakeTollProvider(TollProvider):
        def get_tolls(
            self,
            route_coordinates: list[tuple[float, float]],
        ) -> list[TollFee]:
            return [
                TollFee(
                    name="Bridge Toll",
                    country="Denmark",
                    amount=5.0,
                    currency="EUR",
                )
            ]

    provider = FakeTollProvider()

    fees = provider.get_tolls(
        [
            (55.6761, 12.5683),
            (55.4038, 10.4024),
        ]
    )

    assert len(fees) == 1
    assert fees[0].name == "Bridge Toll"
    assert fees[0].amount == 5.0


def test_toll_calculation_from_provider():
    class FakeTollProvider(TollProvider):
        def get_tolls(
            self,
            route_coordinates: list[tuple[float, float]],
        ) -> list[TollFee]:
            return [
                TollFee(
                    name="Bridge Toll",
                    country="Denmark",
                    amount=5.0,
                    currency="EUR",
                ),
                TollFee(
                    name="Tunnel Toll",
                    country="Sweden",
                    amount=8.0,
                    currency="EUR",
                ),
            ]

    provider = FakeTollProvider()

    fees = provider.get_tolls(
        [
            (55.6761, 12.5683),
            (55.4038, 10.4024),
        ]
    )

    calculation = TollCalculation(
        fees=fees,
        currency="EUR",
    )

    assert calculation.total_amount == 13.0
    assert len(calculation.fees) == 2


def test_calculate_route_tolls_uses_provider():
    class FakeTollProvider(TollProvider):
        def get_tolls(
            self,
            route_coordinates: list[tuple[float, float]],
        ) -> list[TollFee]:
            return [
                TollFee(
                    name="Bridge Toll",
                    country="Denmark",
                    amount=5.0,
                    currency="EUR",
                ),
                TollFee(
                    name="Tunnel Toll",
                    country="Sweden",
                    amount=8.0,
                    currency="EUR",
                ),
            ]

    provider = FakeTollProvider()

    calculation = calculate_route_tolls(
        route_coordinates=[
            (55.6761, 12.5683),
            (55.4038, 10.4024),
        ],
        provider=provider,
        currency="EUR",
    )

    assert calculation.total_amount == 13.0
    assert len(calculation.fees) == 2


def test_toll_calculation_rejects_empty_currency():
    with pytest.raises(ValueError, match="Currency cannot be empty"):
        TollCalculation(
            fees=[],
            currency="",
        )


def test_calculate_route_tolls_with_empty_route():
    provider = TollProvider()

    calculation = calculate_route_tolls(
        route_coordinates=[],
        provider=provider,
        currency="EUR",
    )

    assert calculation.fees == []
    assert calculation.total_amount == 0.0
    assert calculation.currency == "EUR"


def test_calculate_route_tolls_rejects_invalid_latitude():
    provider = TollProvider()

    with pytest.raises(ValueError, match="Invalid latitude"):
        calculate_route_tolls(
            route_coordinates=[
                (95.0, 12.5683),
            ],
            provider=provider,
            currency="EUR",
        )


def test_calculate_route_tolls_passes_route_to_provider():
    class RecordingTollProvider(TollProvider):
        def __init__(self):
            self.received_route = None

        def get_tolls(self, route_coordinates):
            self.received_route = route_coordinates
            return []

    provider = RecordingTollProvider()

    route = [
        (59.3293, 18.0686),
        (59.3326, 18.0649),
        (59.3346, 18.0632),
    ]

    calculate_route_tolls(
        route_coordinates=route,
        provider=provider,
        currency="EUR",
    )

    assert provider.received_route == route


def test_calculate_route_tolls_rejects_invalid_provider_fee():
    class InvalidTollProvider(TollProvider):
        def get_tolls(self, route_coordinates):
            return [
                TollFee(
                    name="Invalid Toll",
                    country="Sweden",
                    amount=-10.0,
                    currency="EUR",
                )
            ]

    provider = InvalidTollProvider()

    with pytest.raises(ValueError, match="Toll amount cannot be negative"):
        calculate_route_tolls(
            route_coordinates=[(59.3293, 18.0686)],
            provider=provider,
            currency="EUR",
        )


def test_calculate_trip_route_tolls_uses_route_coordinates():
    class RecordingTollProvider(TollProvider):
        def __init__(self):
            self.received_route = None

        def get_tolls(self, route_coordinates):
            self.received_route = route_coordinates
            return []

    provider = RecordingTollProvider()

    trip = Trip(
        user_id=1,
        name="Test Trip",
        start_location="Stockholm",
        destination="Gothenburg",
        trip_type=TripType.ONE_WAY,
        departure_at=datetime.now(),
        travelers=1,
        duration_days=1,
    )

    destinations = []

    # We'll mock the route calculation here.


def test_calculate_trip_route_tolls_uses_route_coordinates():
    class RecordingTollProvider(TollProvider):
        def __init__(self):
            self.received_route = None

        def get_tolls(self, route_coordinates):
            self.received_route = route_coordinates
            return []

    provider = RecordingTollProvider()

    trip = Trip(
        user_id=1,
        name="Test Trip",
        start_location="Stockholm",
        destination="Gothenburg",
        trip_type=TripType.ONE_WAY,
        departure_at=datetime.now(),
        travelers=1,
        duration_days=1,
    )

    expected_coordinates = [
        [18.0686, 59.3293],
        [18.0649, 59.3326],
        [11.9746, 57.7089],
    ]

    fake_route_details = {
        "route": {
            "geometry": {
                "coordinates": expected_coordinates,
            }
        }
    }

    with patch(
        "app.services.trip_route.calculate_trip_route_details",
        return_value=fake_route_details,
    ):
        calculate_trip_route_tolls(
            trip=trip,
            destinations=[],
            preference=RoutePreference.FASTEST,
            provider=provider,
            currency="EUR",
        )

    assert provider.received_route == expected_coordinates


def test_calculate_trip_route_tolls_returns_provider_fees_and_total():
    class FakeTollProvider(TollProvider):
        def get_tolls(self, route_coordinates):
            return [
                TollFee(
                    name="Stockholm Bridge",
                    country="Sweden",
                    amount=15.0,
                    currency="EUR",
                ),
                TollFee(
                    name="Gothenburg Road Fee",
                    country="Sweden",
                    amount=25.0,
                    currency="EUR",
                ),
            ]

    provider = FakeTollProvider()

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
        result = calculate_trip_route_tolls(
            trip=trip,
            destinations=[],
            preference=RoutePreference.FASTEST,
            provider=provider,
            currency="EUR",
        )

    assert len(result.fees) == 2
    assert result.fees[0].name == "Stockholm Bridge"
    assert result.fees[1].name == "Gothenburg Road Fee"
    assert result.total_amount == 40.0
    assert result.currency == "EUR"


def test_calculate_trip_route_tolls_rejects_provider_currency_mismatch():
    class MismatchedCurrencyProvider(TollProvider):
        def get_tolls(self, route_coordinates):
            return [
                TollFee(
                    name="Swedish Road Fee",
                    country="Sweden",
                    amount=20.0,
                    currency="SEK",
                )
            ]

    provider = MismatchedCurrencyProvider()

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
        with pytest.raises(
            ValueError,
            match="All toll fees must use the same currency",
        ):
            calculate_trip_route_tolls(
                trip=trip,
                destinations=[],
                preference=RoutePreference.FASTEST,
                provider=provider,
                currency="EUR",
            )