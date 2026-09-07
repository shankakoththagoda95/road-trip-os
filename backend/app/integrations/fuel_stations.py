from dataclasses import dataclass
import httpx


@dataclass
class FuelStation:
    provider_id: str
    name: str
    latitude: float
    longitude: float
    country: str | None
    fuel_types: list[str]


class FuelStationProvider:
    def search_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
    ) -> list[FuelStation]:
        raise NotImplementedError


class OverpassFuelStationProvider(FuelStationProvider):
    OVERPASS_URL = "https://overpass-api.de/api/interpreter"

    def search_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
    ) -> list[FuelStation]:
        if not -90 <= latitude <= 90:
            raise ValueError("Latitude must be between -90 and 90")

        if not -180 <= longitude <= 180:
            raise ValueError("Longitude must be between -180 and 180")

        if radius_km <= 0:
            raise ValueError("Radius must be greater than zero")

        radius_meters = radius_km * 1000

        query = f"""
        [out:json];
        nwr[
            amenity=fuel
        ](
            around:{radius_meters},{latitude},{longitude}
        );
        out center;
        """

        response = httpx.get(
            self.OVERPASS_URL,
            params={"data": query},
            timeout=30.0,
        )

        response.raise_for_status()

        data = response.json()

        stations = []

        for element in data.get("elements", []):
            tags = element.get("tags", {})

            if element["type"] == "node":
                station_latitude = element.get("lat")
                station_longitude = element.get("lon")
            else:
                center = element.get("center", {})
                station_latitude = center.get("lat")
                station_longitude = center.get("lon")

            if station_latitude is None or station_longitude is None:
                continue

            fuel_types = []

            if tags.get("fuel:diesel") == "yes":
                fuel_types.append("diesel")

            if tags.get("fuel:octane_95") == "yes":
                fuel_types.append("petrol_95")

            if tags.get("fuel:e10") == "yes":
                fuel_types.append("e10")

            stations.append(
                FuelStation(
                    provider_id=f"{element['type']}/{element['id']}",
                    name=tags.get(
                        "name",
                        "Unnamed fuel station",
                    ),
                    latitude=station_latitude,
                    longitude=station_longitude,
                    country=tags.get("addr:country"),
                    fuel_types=fuel_types,
                )
            )

        return stations