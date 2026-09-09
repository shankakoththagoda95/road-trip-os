import httpx

from dataclasses import dataclass
from abc import ABC, abstractmethod


@dataclass
class ElevationPoint:
    latitude: float
    longitude: float
    elevation_m: float


class ElevationProvider(ABC):
    @abstractmethod
    def get_elevation(
        self,
        latitude: float,
        longitude: float,
    ) -> ElevationPoint:
        pass


    @abstractmethod
    def get_elevations(
        self,
        coordinates: list[tuple[float, float]],
    ) -> list[ElevationPoint]:
        pass


class OpenMeteoElevationProvider(ElevationProvider):
    BASE_URL = "https://api.open-meteo.com/v1/elevation"

    def get_elevation(
        self,
        latitude: float,
        longitude: float,
    ) -> ElevationPoint:
        response = httpx.get(
            self.BASE_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
            },
        )

        response.raise_for_status()

        data = response.json()

        return ElevationPoint(
            latitude=latitude,
            longitude=longitude,
            elevation_m=data["elevation"][0],
        )


    def get_elevations(
        self,
        coordinates: list[tuple[float, float]],
    ) -> list[ElevationPoint]:
        if not coordinates:
            return []
    
        latitudes = [latitude for latitude, _ in coordinates]
        longitudes = [longitude for _, longitude in coordinates]
    
        response = httpx.get(
            self.BASE_URL,
            params={
                "latitude": ",".join(map(str, latitudes)),
                "longitude": ",".join(map(str, longitudes)),
            },
        )
    
        response.raise_for_status()
    
        data = response.json()
    
        elevations = data["elevation"]
    
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