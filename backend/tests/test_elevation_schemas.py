import pytest
from pydantic import ValidationError

from app.schemas.elevation import (
    ElevationProfileRequest,
    ElevationProfileResponse,
    ElevationRequest,
    ElevationResponse,
    TerrainSummaryResponse,
)


def test_elevation_request_valid():
    request = ElevationRequest(
        latitude=59.3293,
        longitude=18.0686,
    )

    assert request.latitude == 59.3293
    assert request.longitude == 18.0686


def test_elevation_response_valid():
    response = ElevationResponse(
        latitude=59.3293,
        longitude=18.0686,
        elevation_m=24.0,
    )

    assert response.latitude == 59.3293
    assert response.longitude == 18.0686
    assert response.elevation_m == 24.0


@pytest.mark.parametrize(
    "latitude",
    [-91, 91],
)
def test_elevation_request_rejects_invalid_latitude(latitude):
    with pytest.raises(ValidationError):
        ElevationRequest(
            latitude=latitude,
            longitude=18.0686,
        )


@pytest.mark.parametrize(
    "longitude",
    [-181, 181],
)
def test_elevation_request_rejects_invalid_longitude(longitude):
    with pytest.raises(ValidationError):
        ElevationRequest(
            latitude=59.3293,
            longitude=longitude,
        )


def test_elevation_profile_request_valid():
    request = ElevationProfileRequest(
        coordinates=[
            (59.3293, 18.0686),
            (59.1950, 17.6253),
        ],
    )

    assert len(request.coordinates) == 2
    assert request.coordinates[0] == (59.3293, 18.0686)


def test_elevation_profile_request_rejects_empty_coordinates():
    with pytest.raises(ValidationError):
        ElevationProfileRequest(
            coordinates=[],
        )


def test_elevation_profile_response_valid():
    response = ElevationProfileResponse(
        points=[
            ElevationResponse(
                latitude=59.3293,
                longitude=18.0686,
                elevation_m=24.0,
            ),
            ElevationResponse(
                latitude=59.1950,
                longitude=17.6253,
                elevation_m=40.0,
            ),
        ],
    )

    assert len(response.points) == 2
    assert response.points[0].elevation_m == 24.0
    assert response.points[1].elevation_m == 40.0


def test_terrain_summary_response_valid():
    response = TerrainSummaryResponse(
        total_ascent_m=53.0,
        total_descent_m=25.0,
        max_elevation_m=52.0,
        min_elevation_m=15.0,
        elevation_range_m=37.0,
    )

    assert response.total_ascent_m == 53.0
    assert response.total_descent_m == 25.0
    assert response.max_elevation_m == 52.0
    assert response.min_elevation_m == 15.0
    assert response.elevation_range_m == 37.0


@pytest.mark.parametrize(
    "coordinates",
    [
        [(91.0, 18.0686)],
        [(-91.0, 18.0686)],
    ],
)
def test_elevation_profile_request_rejects_invalid_latitude(
    coordinates,
):
    with pytest.raises(ValidationError):
        ElevationProfileRequest(
            coordinates=coordinates,
        )


@pytest.mark.parametrize(
    "coordinates",
    [
        [(59.3293, 181.0)],
        [(59.3293, -181.0)],
    ],
)
def test_elevation_profile_request_rejects_invalid_longitude(
    coordinates,
):
    with pytest.raises(ValidationError):
        ElevationProfileRequest(
            coordinates=coordinates,
        )


def test_elevation_profile_request_accepts_valid_boundary_coordinates():
    request = ElevationProfileRequest(
        coordinates=[
            (-90.0, -180.0),
            (90.0, 180.0),
        ],
    )

    assert len(request.coordinates) == 2