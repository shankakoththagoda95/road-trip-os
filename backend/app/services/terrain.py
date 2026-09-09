from dataclasses import dataclass

@dataclass
class TerrainSummary:
    total_ascent_m: float
    total_descent_m: float
    max_elevation_m: float
    min_elevation_m: float
    elevation_range_m: float


def calculate_total_ascent(
    elevations_m: list[float],
) -> float:
    if not elevations_m:
        return 0.0

    total_ascent = 0.0

    for previous, current in zip(
        elevations_m,
        elevations_m[1:],
    ):
        elevation_gain = current - previous

        if elevation_gain > 0:
            total_ascent += elevation_gain

    return total_ascent


def calculate_total_descent(
    elevations_m: list[float],
) -> float:
    if not elevations_m:
        return 0.0

    total_descent = 0.0

    for previous, current in zip(
        elevations_m,
        elevations_m[1:],
    ):
        elevation_loss = previous - current

        if elevation_loss > 0:
            total_descent += elevation_loss

    return total_descent


def calculate_max_elevation(
    elevations_m: list[float],
) -> float:
    if not elevations_m:
        return 0.0

    return max(elevations_m)


def calculate_min_elevation(
    elevations_m: list[float],
) -> float:
    if not elevations_m:
        return 0.0

    return min(elevations_m)


def calculate_elevation_range(
    elevations_m: list[float],
) -> float:
    if not elevations_m:
        return 0.0

    return max(elevations_m) - min(elevations_m)


def calculate_terrain_summary(
    elevations_m: list[float],
) -> TerrainSummary:
    return TerrainSummary(
        total_ascent_m=calculate_total_ascent(elevations_m),
        total_descent_m=calculate_total_descent(elevations_m),
        max_elevation_m=calculate_max_elevation(elevations_m),
        min_elevation_m=calculate_min_elevation(elevations_m),
        elevation_range_m=calculate_elevation_range(elevations_m),
    )