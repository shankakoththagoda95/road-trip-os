from fastapi import APIRouter

from app.integrations.elevation import OpenMeteoElevationProvider
from app.schemas.elevation import (
    ElevationProfileRequest,
    ElevationProfileResponse,
    ElevationRequest,
    ElevationResponse,
)
from app.schemas.elevation import (
    ElevationProfileRequest,
    ElevationProfileResponse,
    ElevationRequest,
    ElevationResponse,
    TerrainSummaryResponse,
)
from app.services.elevation import (
    get_elevation,
    get_elevations,
    get_terrain_summary,
)


router = APIRouter(
    prefix="/elevation",
    tags=["elevation"],
)


@router.post(
    "/point",
    response_model=ElevationResponse,
)
def get_elevation_point(
    request: ElevationRequest,
):
    provider = OpenMeteoElevationProvider()

    elevation = get_elevation(
        provider=provider,
        latitude=request.latitude,
        longitude=request.longitude,
    )

    return ElevationResponse(
        latitude=elevation.latitude,
        longitude=elevation.longitude,
        elevation_m=elevation.elevation_m,
    )


@router.post(
    "/profile",
    response_model=ElevationProfileResponse,
)
def get_elevation_profile(
    request: ElevationProfileRequest,
):
    provider = OpenMeteoElevationProvider()

    elevations = get_elevations(
        provider=provider,
        coordinates=request.coordinates,
    )

    return ElevationProfileResponse(
        points=[
            ElevationResponse(
                latitude=point.latitude,
                longitude=point.longitude,
                elevation_m=point.elevation_m,
            )
            for point in elevations
        ],
    )


@router.post(
    "/terrain-summary",
    response_model=TerrainSummaryResponse,
)
def get_terrain_summary_endpoint(
    request: ElevationProfileRequest,
):
    provider = OpenMeteoElevationProvider()

    summary = get_terrain_summary(
        provider=provider,
        coordinates=request.coordinates,
    )

    return TerrainSummaryResponse(
        total_ascent_m=summary.total_ascent_m,
        total_descent_m=summary.total_descent_m,
        max_elevation_m=summary.max_elevation_m,
        min_elevation_m=summary.min_elevation_m,
        elevation_range_m=summary.elevation_range_m,
    )