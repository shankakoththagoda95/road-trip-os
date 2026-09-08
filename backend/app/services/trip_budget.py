def calculate_estimated_total(
    estimated_fuel_cost: float,
    estimated_ev_charging_cost: float,
    estimated_toll_cost: float,
    estimated_food_cost: float,
    estimated_parking_cost: float,
    estimated_other_cost: float,
) -> float:
    return (
        estimated_fuel_cost
        + estimated_ev_charging_cost
        + estimated_toll_cost
        + estimated_food_cost
        + estimated_parking_cost
        + estimated_other_cost
    )


def calculate_actual_total(
    actual_fuel_cost: float,
    actual_ev_charging_cost: float,
    actual_toll_cost: float,
    actual_food_cost: float,
    actual_parking_cost: float,
    actual_other_cost: float,
) -> float:
    return (
        actual_fuel_cost
        + actual_ev_charging_cost
        + actual_toll_cost
        + actual_food_cost
        + actual_parking_cost
        + actual_other_cost
    )


def calculate_remaining_budget(
    estimated_total: float,
    actual_total: float,
) -> float:
    return estimated_total - actual_total