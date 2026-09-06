from app.services.fuel import (
    calculate_fuel_range,
    calculate_fuel_remaining,
)
from app.services.geography import (
    GPS_MIN_MOVEMENT_METERS,
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