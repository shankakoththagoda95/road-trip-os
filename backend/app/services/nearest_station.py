import math
from dataclasses import dataclass, replace

from app.integrations.ev_charging import EVChargingStation
from app.integrations.fuel_stations import FuelStation
from app.services.geography import calculate_distance_km

# Areas actually queried, in km. The answer is the same as growing the
# radius 1 km at a time (see find_nearest_expanding), with far fewer calls
# to the map services.
SEARCH_WINDOWS_KM = (1, 5, 10, 25, 50)
MAX_RADIUS_KM = 50
MAX_RESULTS = 5
# OpenStreetMap often has a fuel station twice (a point and the building);
# entries closer than this are treated as one.
DUPLICATE_WITHIN_KM = 0.06
# Open Charge Map sometimes lists one site twice (same name, same spot).
DUPLICATE_CHARGER_WITHIN_KM = 0.015


@dataclass
class NearbyStation:
    station: object
    distance_km: float


@dataclass
class ExpandingSearchResult:
    # Smallest whole-km radius with at least one station.
    radius_km: int
    # Stations within that radius, nearest first.
    stations: list[NearbyStation]
    # How many times the provider was asked.
    searches: int


def merge_duplicate_fuel_stations(stations: list[FuelStation]) -> list[FuelStation]:
    """
    One entry per fuel station: entries within DUPLICATE_WITHIN_KM of each
    other are merged, keeping a real name and every fuel type.
    """

    merged: list[FuelStation] = []

    for station in stations:
        twin = next(
            (
                kept
                for kept in merged
                if calculate_distance_km(
                    kept.latitude, kept.longitude, station.latitude, station.longitude
                )
                <= DUPLICATE_WITHIN_KM
            ),
            None,
        )

        if twin is None:
            merged.append(replace(station, fuel_types=list(station.fuel_types)))
            continue

        if twin.name.startswith("Unnamed") or (
            not station.name.startswith("Unnamed") and len(station.name) > len(twin.name)
        ):
            twin.name = station.name
        twin.fuel_types += [
            fuel for fuel in station.fuel_types if fuel not in twin.fuel_types
        ]
        twin.country = twin.country or station.country

    return merged


def merge_duplicate_chargers(
    stations: list[EVChargingStation],
) -> list[EVChargingStation]:
    """
    One entry per charging site: entries with the same name within
    DUPLICATE_CHARGER_WITHIN_KM are merged (all connectors, fastest power).
    Different chargers next to each other stay separate.
    """

    merged: list[EVChargingStation] = []

    for station in stations:
        twin = next(
            (
                kept
                for kept in merged
                if kept.name.strip().lower() == station.name.strip().lower()
                and calculate_distance_km(
                    kept.latitude, kept.longitude, station.latitude, station.longitude
                )
                <= DUPLICATE_CHARGER_WITHIN_KM
            ),
            None,
        )

        if twin is None:
            merged.append(
                replace(station, connector_types=list(station.connector_types))
            )
            continue

        twin.connector_types += [
            connector
            for connector in station.connector_types
            if connector not in twin.connector_types
        ]
        powers = [
            power
            for power in (twin.charging_power_kw, station.charging_power_kw)
            if power is not None
        ]
        twin.charging_power_kw = max(powers) if powers else None
        twin.operator = twin.operator or station.operator

    return merged


def find_nearest_expanding(
    provider,
    latitude: float,
    longitude: float,
    max_radius_km: int = MAX_RADIUS_KM,
) -> ExpandingSearchResult | None:
    """
    Grow the search radius 1 km at a time until at least one station is
    inside it; None when there's none within `max_radius_km`.

    Instead of one request per kilometre, nested areas are fetched and the
    1 km step is worked out from the distances: a station 3.4 km away is
    first inside a 4 km radius, whichever way it's found.
    """

    checked_km = 0
    searches = 0
    windows = [km for km in SEARCH_WINDOWS_KM if km < max_radius_km] + [max_radius_km]

    for window_km in windows:
        searches += 1
        stations = provider.search_nearby(
            latitude=latitude,
            longitude=longitude,
            radius_km=window_km,
        )

        if stations and all(isinstance(station, FuelStation) for station in stations):
            stations = merge_duplicate_fuel_stations(stations)
        elif stations and all(
            isinstance(station, EVChargingStation) for station in stations
        ):
            stations = merge_duplicate_chargers(stations)

        found = sorted(
            (
                NearbyStation(
                    station=station,
                    distance_km=calculate_distance_km(
                        latitude, longitude, station.latitude, station.longitude
                    ),
                )
                for station in stations
            ),
            key=lambda nearby: nearby.distance_km,
        )
        within = [nearby for nearby in found if nearby.distance_km <= window_km]

        if within:
            radius_km = max(checked_km + 1, math.ceil(within[0].distance_km), 1)
            return ExpandingSearchResult(
                radius_km=radius_km,
                stations=[
                    nearby for nearby in within if nearby.distance_km <= radius_km
                ][:MAX_RESULTS],
                searches=searches,
            )

        checked_km = window_km

    return None
