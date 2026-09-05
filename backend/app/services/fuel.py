def calculate_fuel_required(
    distance_km: float,
    consumption_l_per_100km: float,
) -> float:
    if distance_km < 0:
        raise ValueError("Distance cannot be negative")

    if consumption_l_per_100km < 0:
        raise ValueError("Fuel consumption cannot be negative")

    return (distance_km / 100) * consumption_l_per_100km


def calculate_fuel_cost(
    fuel_required: float,
    fuel_price_per_liter: float,
) -> float:
    if fuel_required < 0:
        raise ValueError("Fuel required cannot be negative")

    if fuel_price_per_liter < 0:
        raise ValueError("Fuel price cannot be negative")

    return fuel_required * fuel_price_per_liter