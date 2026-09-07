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