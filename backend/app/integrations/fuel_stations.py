import time
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
    # The public server is often briefly overloaded; one retry usually
    # gets through.
    ATTEMPTS = 2
    RETRY_DELAY_SECONDS = 2.0
    BUSY_STATUSES = {429, 502, 503, 504}

    def _post(self, query: str) -> httpx.Response:
        for attempt in range(1, self.ATTEMPTS + 1):
            try:
                # Overpass rejects requests without an identifying
                # User-Agent (406).
                response = httpx.post(
                    self.OVERPASS_URL,
                    data={"data": query},
                    headers={
                        "User-Agent": "Road-Trip-OS/1.0 (development project)",
                    },
                    timeout=30.0,
                )
            except httpx.TimeoutException:
                if attempt == self.ATTEMPTS:
                    raise
            else:
                if (
                    response.status_code not in self.BUSY_STATUSES
                    or attempt == self.ATTEMPTS
                ):
                    return response

            time.sleep(self.RETRY_DELAY_SECONDS)

        raise AssertionError("unreachable")

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
        [out:json][timeout:25];
        nwr[
            amenity=fuel
        ](
            around:{radius_meters},{latitude},{longitude}
        );
        out center;
        """

        response = self._post(query)
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