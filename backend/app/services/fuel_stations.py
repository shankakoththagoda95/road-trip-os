from app.integrations.fuel_stations import (
    FuelStation,
    FuelStationProvider,
)
from app.services.geography import calculate_distance_km
from dataclasses import dataclass


def _closest_point_on_segment(
    start: tuple[float, float],
    end: tuple[float, float],
    point: tuple[float, float],
) -> tuple[float, float]:
    start_latitude, start_longitude = start
    end_latitude, end_longitude = end
    point_latitude, point_longitude = point

    segment_latitude = end_latitude - start_latitude
    segment_longitude = end_longitude - start_longitude

    segment_length_squared = (
        segment_latitude ** 2
        + segment_longitude ** 2
    )

    if segment_length_squared == 0:
        return start

    projection = (
        (point_latitude - start_latitude) * segment_latitude
        + (point_longitude - start_longitude) * segment_longitude
    ) / segment_length_squared

    projection = max(0.0, min(1.0, projection))

    return (
        start_latitude + projection * segment_latitude,
        start_longitude + projection * segment_longitude,
    )


@dataclass
class FuelStationRecommendation:
    station: FuelStation
    distance_km: float
    detour_distance_km: float
    reserve_km: float


class FuelStationService:
    def __init__(self, provider: FuelStationProvider):
        self.provider = provider

    def find_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
    ) -> list[FuelStation]:
        return self.provider.search_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
        )

    def find_nearest(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
    ) -> FuelStation | None:
        stations = self.find_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_km=radius_km,
        )
    
        if not stations:
            return None
    
        return min(
            stations,
            key=lambda station: calculate_distance_km(
                latitude,
                longitude,
                station.latitude,
                station.longitude,
            ),
        )


    def find_along_route(
        self,
        route_coordinates: list[tuple[float, float]],
        search_radius_km: float = 2.0,
    ) -> list[FuelStation]:
        if search_radius_km <= 0:
            raise ValueError("Search radius must be greater than zero")

        if not route_coordinates:
            return []

        latitude = route_coordinates[0][0]
        longitude = route_coordinates[0][1]

        stations = self.find_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_km=search_radius_km,
        )

        stations_along_route = []

        for station in stations:
            is_near_route = any(
                calculate_distance_km(
                    route_latitude,
                    route_longitude,
                    station.latitude,
                    station.longitude,
                ) <= search_radius_km
                for route_latitude, route_longitude in route_coordinates
            )

            if is_near_route:
                stations_along_route.append(station)

        return stations_along_route

    def calculate_detour_distance(
        self,
        route_coordinates: list[tuple[float, float]],
        station: FuelStation,
    ) -> float:
        if len(route_coordinates) < 2:
            raise ValueError(
                "At least two route coordinates are required"
            )

        station_coordinates = (
            station.latitude,
            station.longitude,
        )

        closest_route_distance_km = float("inf")

        for index in range(len(route_coordinates) - 1):
            start = route_coordinates[index]
            end = route_coordinates[index + 1]

            closest_point = _closest_point_on_segment(
                start=start,
                end=end,
                point=station_coordinates,
            )

            distance_to_route_km = calculate_distance_km(
                station.latitude,
                station.longitude,
                closest_point[0],
                closest_point[1],
            )

            closest_route_distance_km = min(
                closest_route_distance_km,
                distance_to_route_km,
            )

        return 2 * closest_route_distance_km


    def can_reach_station(
        self,
        current_location: tuple[float, float],
        station: FuelStation,
        current_fuel: float,
        consumption_l_per_100km: float,
        reserve_km: float = 0.0,
    ) -> bool:
        if reserve_km < 0:
            raise ValueError("Reserve distance cannot be negative")
        if current_fuel < 0:
            raise ValueError("Current fuel cannot be negative")

        if consumption_l_per_100km <= 0:
            raise ValueError(
                "Fuel consumption must be greater than zero"
            )

        distance_to_station_km = calculate_distance_km(
            current_location[0],
            current_location[1],
            station.latitude,
            station.longitude,
        )

        available_range_km = (
            current_fuel / consumption_l_per_100km
        ) * 100

        usable_range_km = max(
            available_range_km - reserve_km,
            0.0,
        )

        return distance_to_station_km <= usable_range_km


    def recommend_fuel_station(
        self,
        current_location: tuple[float, float],
        stations: list[FuelStation],
        current_fuel: float,
        consumption_l_per_100km: float,
        reserve_km: float = 0.0,
        route_coordinates: list[tuple[float, float]] | None = None,
    ) -> FuelStationRecommendation | None:
        reachable_stations = [
            station
            for station in stations
            if self.can_reach_station(
                current_location=current_location,
                station=station,
                current_fuel=current_fuel,
                consumption_l_per_100km=consumption_l_per_100km,
                reserve_km=reserve_km,
            )
        ]
    
        if not reachable_stations:
            return None
    
        recommended_station = min(
            reachable_stations,
            key=lambda station: calculate_distance_km(
                current_location[0],
                current_location[1],
                station.latitude,
                station.longitude,
            ),
        )
    
        distance_km = calculate_distance_km(
            current_location[0],
            current_location[1],
            recommended_station.latitude,
            recommended_station.longitude,
        )
    
        if route_coordinates is not None and len(route_coordinates) >= 2:
            detour_distance_km = self.calculate_detour_distance(
                route_coordinates=route_coordinates,
                station=recommended_station,
            )
        else:
            detour_distance_km = 2 * distance_km
            
        return FuelStationRecommendation(
            station=recommended_station,
            distance_km=distance_km,
            detour_distance_km=detour_distance_km,
            reserve_km=reserve_km,
        )