from app.schemas.fuel import TripFuelEstimateResponse


def test_trip_fuel_estimate_response_accepts_valid_data():
    estimate = TripFuelEstimateResponse(
        trip_id=1,
        distance_km=600,
        fuel_required=36,
        fuel_price_per_liter=1.80,
        estimated_fuel_cost=64.80,
    )

    assert estimate.trip_id == 1
    assert estimate.distance_km == 600
    assert estimate.fuel_required == 36
    assert estimate.fuel_price_per_liter == 1.80
    assert estimate.estimated_fuel_cost == 64.80