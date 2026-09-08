from dataclasses import dataclass


@dataclass
class EVChargingRequirement:
    needs_charging: bool
    available_range_km: float
    route_distance_km: float
    range_shortfall_km: float


def calculate_charging_requirement(
    available_range_km: float,
    route_distance_km: float,
) -> EVChargingRequirement:
    if available_range_km < 0:
        raise ValueError(
            "Available range cannot be negative"
        )

    if route_distance_km < 0:
        raise ValueError(
            "Route distance cannot be negative"
        )

    range_shortfall_km = max(
        route_distance_km - available_range_km,
        0,
    )

    return EVChargingRequirement(
        needs_charging=range_shortfall_km > 0,
        available_range_km=available_range_km,
        route_distance_km=route_distance_km,
        range_shortfall_km=range_shortfall_km,
    )


def calculate_ev_range(
    battery_capacity_kwh: float,
    battery_percentage: float,
    energy_consumption_kwh_per_100km: float,
) -> float:
    if battery_capacity_kwh <= 0:
        raise ValueError("Battery capacity must be greater than zero")

    if battery_percentage < 0 or battery_percentage > 100:
        raise ValueError("Battery percentage must be between 0 and 100")

    if energy_consumption_kwh_per_100km <= 0:
        raise ValueError(
            "Energy consumption must be greater than zero"
        )

    available_energy_kwh = (
        battery_capacity_kwh * battery_percentage / 100
    )

    return (
        available_energy_kwh
        / energy_consumption_kwh_per_100km
    ) * 100


def calculate_available_battery_energy(
    battery_capacity_kwh: float,
    battery_percentage: float,
) -> float:
    if battery_capacity_kwh <= 0:
        raise ValueError(
            "Battery capacity must be greater than zero"
        )

    if battery_percentage < 0 or battery_percentage > 100:
        raise ValueError(
            "Battery percentage must be between 0 and 100"
        )

    return (
        battery_capacity_kwh
        * battery_percentage
        / 100
    )


def needs_charging_stop(
    available_range_km: float,
    route_distance_km: float,
) -> bool:
    if available_range_km < 0:
        raise ValueError(
            "Available range cannot be negative"
        )

    if route_distance_km < 0:
        raise ValueError(
            "Route distance cannot be negative"
        )

    return route_distance_km > available_range_km


def calculate_vehicle_charging_requirement(
    battery_capacity_kwh: float,
    battery_percentage: float,
    energy_consumption_kwh_per_100km: float,
    route_distance_km: float,
) -> EVChargingRequirement:
    available_range_km = calculate_ev_range(
        battery_capacity_kwh=battery_capacity_kwh,
        battery_percentage=battery_percentage,
        energy_consumption_kwh_per_100km=energy_consumption_kwh_per_100km,
    )

    return calculate_charging_requirement(
        available_range_km=available_range_km,
        route_distance_km=route_distance_km,
    )


def calculate_usable_ev_range(
    available_range_km: float,
    safety_buffer_percentage: float = 20,
) -> float:
    if available_range_km < 0:
        raise ValueError(
            "Available range cannot be negative"
        )

    if safety_buffer_percentage < 0 or safety_buffer_percentage >= 100:
        raise ValueError(
            "Safety buffer percentage must be between 0 and 100"
        )

    usable_percentage = 100 - safety_buffer_percentage

    return available_range_km * usable_percentage / 100


def calculate_vehicle_charging_requirement_with_buffer(
    battery_capacity_kwh: float,
    battery_percentage: float,
    energy_consumption_kwh_per_100km: float,
    route_distance_km: float,
    safety_buffer_percentage: float = 20,
) -> EVChargingRequirement:
    available_range_km = calculate_ev_range(
        battery_capacity_kwh=battery_capacity_kwh,
        battery_percentage=battery_percentage,
        energy_consumption_kwh_per_100km=energy_consumption_kwh_per_100km,
    )

    usable_range_km = calculate_usable_ev_range(
        available_range_km=available_range_km,
        safety_buffer_percentage=safety_buffer_percentage,
    )

    return calculate_charging_requirement(
        available_range_km=usable_range_km,
        route_distance_km=route_distance_km,
    )