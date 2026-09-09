from app.integrations.elevation import (
    ElevationPoint,
    ElevationProvider,
)
from app.services.terrain import (
    TerrainSummary,
    calculate_terrain_summary,
)


def get_elevation(
    provider: ElevationProvider,
    latitude: float,
    longitude: float,
) -> ElevationPoint:
    return provider.get_elevation(
        latitude=latitude,
        longitude=longitude,
    )


def get_elevations(
    provider: ElevationProvider,
    coordinates: list[tuple[float, float]],
) -> list[ElevationPoint]:
    return provider.get_elevations(
        coordinates=coordinates,
    )


def get_terrain_summary(
    provider: ElevationProvider,
    coordinates: list[tuple[float, float]],
) -> TerrainSummary:
    elevation_points = get_elevations(
        provider=provider,
        coordinates=coordinates,
    )

    elevations_m = [
        point.elevation_m
        for point in elevation_points
    ]

    return calculate_terrain_summary(elevations_m)