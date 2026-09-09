from app.integrations.elevation import ElevationPoint
from app.services.elevation import (
    get_elevation,
    get_elevations,
    get_terrain_summary,
)


class FakeElevationProvider:
    def get_elevation(
        self,
        latitude: float,
        longitude: float,
    ) -> ElevationPoint:
        return ElevationPoint(
            latitude=latitude,
            longitude=longitude,
            elevation_m=24.0,
        )


    def get_elevations(
        self,
        coordinates: list[tuple[float, float]],
    ) -> list[ElevationPoint]:
        return [
            ElevationPoint(
                latitude=latitude,
                longitude=longitude,
                elevation_m=24.0,
            )
            for latitude, longitude in coordinates
        ]


def test_get_elevation():
    provider = FakeElevationProvider()

    result = get_elevation(
        provider=provider,
        latitude=59.3293,
        longitude=18.0686,
    )

    assert result.latitude == 59.3293
    assert result.longitude == 18.0686
    assert result.elevation_m == 24.0


def test_get_elevations():
    provider = FakeElevationProvider()

    result = get_elevations(
        provider=provider,
        coordinates=[
            (59.3293, 18.0686),
            (59.1950, 17.6253),
        ],
    )

    assert len(result) == 2
    assert result[0].elevation_m == 24.0
    assert result[1].elevation_m == 24.0


def test_get_terrain_summary():
    class TerrainFakeElevationProvider:
        def get_elevations(
            self,
            coordinates: list[tuple[float, float]],
        ) -> list[ElevationPoint]:
            elevations = [24.0, 40.0, 15.0, 52.0]

            return [
                ElevationPoint(
                    latitude=latitude,
                    longitude=longitude,
                    elevation_m=elevation,
                )
                for (latitude, longitude), elevation in zip(
                    coordinates,
                    elevations,
                )
            ]

    provider = TerrainFakeElevationProvider()

    result = get_terrain_summary(
        provider=provider,
        coordinates=[
            (59.3293, 18.0686),
            (59.1950, 17.6253),
            (58.7530, 17.0079),
            (58.4108, 15.6214),
        ],
    )

    assert result.total_ascent_m == 53.0
    assert result.total_descent_m == 25.0
    assert result.max_elevation_m == 52.0
    assert result.min_elevation_m == 15.0
    assert result.elevation_range_m == 37.0