from fastapi.testclient import TestClient
from app.integrations.elevation import ElevationPoint
from app.main import app


client = TestClient(app)


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


def test_get_elevation_point_api(monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.elevation.OpenMeteoElevationProvider",
        lambda: FakeElevationProvider(),
    )

    response = client.post(
        "/elevation/point",
        json={
            "latitude": 59.3293,
            "longitude": 18.0686,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["latitude"] == 59.3293
    assert data["longitude"] == 18.0686
    assert data["elevation_m"] == 24.0


def test_get_elevation_profile_api(monkeypatch):
    monkeypatch.setattr(
        "app.api.v1.elevation.OpenMeteoElevationProvider",
        lambda: FakeElevationProvider(),
    )

    response = client.post(
        "/elevation/profile",
        json={
            "coordinates": [
                [59.3293, 18.0686],
                [59.1950, 17.6253],
            ],
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data["points"]) == 2

    assert data["points"][0]["latitude"] == 59.3293
    assert data["points"][0]["longitude"] == 18.0686
    assert data["points"][0]["elevation_m"] == 24.0

    assert data["points"][1]["latitude"] == 59.195
    assert data["points"][1]["longitude"] == 17.6253
    assert data["points"][1]["elevation_m"] == 24.0


def test_get_terrain_summary_api(monkeypatch):
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

    monkeypatch.setattr(
        "app.api.v1.elevation.OpenMeteoElevationProvider",
        lambda: TerrainFakeElevationProvider(),
    )

    response = client.post(
        "/elevation/terrain-summary",
        json={
            "coordinates": [
                [59.3293, 18.0686],
                [59.1950, 17.6253],
                [58.7530, 17.0079],
                [58.4108, 15.6214],
            ],
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["total_ascent_m"] == 53.0
    assert data["total_descent_m"] == 25.0
    assert data["max_elevation_m"] == 52.0
    assert data["min_elevation_m"] == 15.0
    assert data["elevation_range_m"] == 37.0