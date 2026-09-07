import os
import httpx
from dotenv import load_dotenv
from dataclasses import dataclass

load_dotenv()



@dataclass
class EVChargingStation:
    provider_id: str
    name: str
    latitude: float
    longitude: float
    country: str | None
    operator: str | None
    connector_types: list[str]
    charging_power_kw: float | None


class EVChargingStationProvider:
    def search_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
    ) -> list[EVChargingStation]:
        raise NotImplementedError


class OpenChargeMapProvider(EVChargingStationProvider):
    BASE_URL = "https://api.openchargemap.io/v3/poi/"

    def __init__(self):
        self.api_key = os.getenv("OPEN_CHARGE_MAP_API_KEY")

        if not self.api_key:
            raise RuntimeError(
                "OPEN_CHARGE_MAP_API_KEY environment variable is not set"
            )

    def search_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
    ) -> list[EVChargingStation]:
        if not -90 <= latitude <= 90:
            raise ValueError(
                "Latitude must be between -90 and 90"
            )

        if not -180 <= longitude <= 180:
            raise ValueError(
                "Longitude must be between -180 and 180"
            )

        if radius_km <= 0:
            raise ValueError(
                "Radius must be greater than zero"
            )

        response = httpx.get(
            self.BASE_URL,
            params={
                "key": self.api_key,
                "latitude": latitude,
                "longitude": longitude,
                "distance": radius_km,
                "distanceunit": "KM",
                "maxresults": 50,
            },
            timeout=30.0,
        )

        response.raise_for_status()

        data = response.json()

        stations = []

        for item in data:
            address_info = item.get("AddressInfo") or {}

            latitude = address_info.get("Latitude")
            longitude = address_info.get("Longitude")

            if latitude is None or longitude is None:
                continue
            
            operator_info = item.get("OperatorInfo") or {}

            connector_types = []
            charging_powers = []

            for connection in item.get("Connections") or []:
                connection_type = connection.get("ConnectionType") or {}
                connection_name = connection_type.get("Title")

                if connection_name and connection_name != "Unknown":
                    connector_types.append(connection_name)

                power_kw = connection.get("PowerKW")

                if power_kw is not None:
                    charging_powers.append(power_kw)

            charging_power_kw = (
                max(charging_powers)
                if charging_powers
                else None
            )

            country_info = address_info.get("Country") or {}

            stations.append(
                EVChargingStation(
                    provider_id=str(item["ID"]),
                    name=address_info.get(
                        "Title",
                        "Unnamed charging station",
                    ),
                    latitude=latitude,
                    longitude=longitude,
                    country=country_info.get("ISOCode"),
                    operator=operator_info.get("Title"),
                    connector_types=connector_types,
                    charging_power_kw=charging_power_kw,
                )
            )

        return stations


    def find_along_route(
        self,
        route_coordinates: list[tuple[float, float]],
        search_radius_km: float = 2.0,
    ) -> list[EVChargingStation]:
        if search_radius_km <= 0:
            raise ValueError(
                "Search radius must be greater than zero"
            )
    
        if not route_coordinates:
            return []
    
        stations_along_route = []
    
        # Search around each route coordinate.
        for latitude, longitude in route_coordinates:
            stations = self.search_nearby(
                latitude=latitude,
                longitude=longitude,
                radius_km=search_radius_km,
            )
    
            for station in stations:
                if station not in stations_along_route:
                    stations_along_route.append(station)
    
        return stations_along_route     