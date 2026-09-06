from app.services.fuel import (
    calculate_fuel_range,
    calculate_fuel_remaining,
    calculate_fuel_required,
)
from app.services.geography import (
    GPS_MIN_MOVEMENT_METERS,
    calculate_distance_km,
    calculate_total_distance_km,
    filter_gps_coordinates_by_distance,
    remove_consecutive_duplicate_coordinates,
)


def estimate_fuel_remaining(
    coordinates: list[tuple[float, float]],
    starting_fuel: float,
    consumption_l_per_100km: float,
    threshold_meters: float = GPS_MIN_MOVEMENT_METERS,
) -> tuple[float, float, float]:
    cleaned_coordinates = remove_consecutive_duplicate_coordinates(
        coordinates
    )
    
    filtered_coordinates = filter_gps_coordinates_by_distance(
        cleaned_coordinates,
        threshold_meters=threshold_meters,
    )

    distance_traveled_km = calculate_total_distance_km(
        filtered_coordinates
    )

    fuel_remaining = calculate_fuel_remaining(
        starting_fuel=starting_fuel,
        distance_traveled_km=distance_traveled_km,
        consumption_l_per_100km=consumption_l_per_100km,
    )

    remaining_range_km = calculate_fuel_range(
        fuel_available=fuel_remaining,
        consumption_l_per_100km=consumption_l_per_100km,
    )

    return (
        distance_traveled_km,
        fuel_remaining,
        remaining_range_km,
    )


def calculate_fuel_for_movement(
    start: tuple[float, float],
    end: tuple[float, float],
    consumption_l_per_100km: float,
) -> tuple[float, float]:
    distance_km = calculate_distance_km(
        start[0],
        start[1],
        end[0],
        end[1],
    )

    fuel_used = calculate_fuel_required(
        distance_km=distance_km,
        consumption_l_per_100km=consumption_l_per_100km,
    )

    return distance_km, fuel_used


def update_fuel_for_movement(
    current_fuel: float,
    total_fuel_used: float,
    fuel_used_for_movement: float,
) -> tuple[float, float]:
    if current_fuel < 0:
        raise ValueError("Current fuel cannot be negative")

    if total_fuel_used < 0:
        raise ValueError("Total fuel used cannot be negative")

    if fuel_used_for_movement < 0:
        raise ValueError("Fuel used for movement cannot be negative")

    new_current_fuel = max(
        current_fuel - fuel_used_for_movement,
        0.0,
    )

    new_total_fuel_used = (
        total_fuel_used + fuel_used_for_movement
    )

    return new_current_fuel, new_total_fuel_used