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


def calculate_trip_fuel_cost(
    distance_km: float,
    consumption_l_per_100km: float,
    fuel_price_per_liter: float,
) -> tuple[float, float]:
    fuel_required = calculate_fuel_required(
        distance_km,
        consumption_l_per_100km,
    )

    fuel_cost = calculate_fuel_cost(
        fuel_required,
        fuel_price_per_liter,
    )

    return fuel_required, fuel_cost


def calculate_fuel_range(
    fuel_available: float,
    consumption_l_per_100km: float,
) -> float:
    if fuel_available < 0:
        raise ValueError("Fuel available cannot be negative")

    if consumption_l_per_100km <= 0:
        raise ValueError("Fuel consumption must be greater than zero")

    return (fuel_available / consumption_l_per_100km) * 100


def calculate_fuel_remaining(
    starting_fuel: float,
    distance_traveled_km: float,
    consumption_l_per_100km: float,
) -> float:
    if starting_fuel < 0:
        raise ValueError("Starting fuel cannot be negative")

    if distance_traveled_km < 0:
        raise ValueError("Distance traveled cannot be negative")

    if consumption_l_per_100km <= 0:
        raise ValueError("Fuel consumption must be greater than zero")

    fuel_used = calculate_fuel_required(
        distance_km=distance_traveled_km,
        consumption_l_per_100km=consumption_l_per_100km,
    )

    fuel_remaining = starting_fuel - fuel_used

    return max(fuel_remaining, 0.0)