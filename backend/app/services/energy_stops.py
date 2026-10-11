import math
from bisect import bisect_left
from collections.abc import Callable
from dataclasses import dataclass, field

import httpx

from app.models.vehicle import Vehicle
from app.services.geography import calculate_distance_km


# Where to look for a station, tried in order (tank / battery level as a
# percentage of its capacity):
# 1. at the reserve level (15% by default), then 5% earlier each time up to
#    40%, within 1 km of the route, then 2 km, then 3 km;
# 2. as a last resort, 5% later each time down to 5%, within 1-5 km.
LEVEL_STEP_PERCENT = 5.0
EARLIEST_LEVEL_PERCENT = 40.0
LATEST_LEVEL_PERCENT = 5.0
EARLY_MAX_RADIUS_KM = 3
LATE_MAX_RADIUS_KM = 5

# Safety net against runaway loops on very long routes.
MAX_STOPS = 50


@dataclass
class EnergyStation:
    provider_id: str
    name: str
    latitude: float
    longitude: float
    # Human-readable extras, e.g. ["diesel", "petrol 95"] or ["150 kW", "CCS"].
    details: list[str] = field(default_factory=list)


@dataclass
class EnergyStop:
    distance_from_start_km: float
    # Point on the route where the stop is planned.
    latitude: float
    longitude: float
    # None when no station was found near the route here.
    station: EnergyStation | None
    distance_from_route_km: float | None
    # Tank / battery level (% of capacity) expected at this point.
    level_percent: float | None = None
    # Search radius (whole km) the station was found within.
    search_radius_km: int | None = None


@dataclass
class EnergyPlan:
    total_distance_km: float
    stops: list[EnergyStop]
    warnings: list[str]


@dataclass
class VehicleEnergyProfile:
    mode: str  # "fuel" or "ev"
    # Range on a full tank / battery.
    full_range_km: float
    # Range when setting off.
    initial_range_km: float
    # Range after each refuel / charge.
    refill_range_km: float
    # Range kept in reserve; stops are planned before dipping into it.
    reserve_km: float


# (latitude, longitude, radius_km) -> stations within that radius.
StationFinder = Callable[[float, float, float], list[EnergyStation]]


def vehicle_energy_profile(
    vehicle: Vehicle,
    start_level_percent: float,
    reserve_percent: float,
    refill_to_percent: float | None,
) -> VehicleEnergyProfile:
    """
    Work out ranges for a vehicle. Electric vehicles plan charging stops;
    everything else plans fuel stops. Plug-in hybrids set off with their
    electric range on top of the fuel range.
    """

    electric_range_km = (
        vehicle.battery_capacity / vehicle.energy_consumption * 100
        if vehicle.battery_capacity and vehicle.energy_consumption
        else None
    )

    if vehicle.fuel_type == "electric":
        if electric_range_km is None:
            raise ValueError(
                "Add the vehicle's battery size and energy use "
                "to plan charging stops"
            )

        mode = "ev"
        full_range_km = electric_range_km
        extra_start_range_km = 0.0
        refill_percent = refill_to_percent if refill_to_percent is not None else 80
    else:
        if not vehicle.tank_capacity or not vehicle.fuel_consumption:
            raise ValueError(
                "Add the vehicle's tank size and fuel consumption "
                "to plan fuel stops"
            )

        mode = "fuel"
        full_range_km = (
            vehicle.tank_capacity / vehicle.fuel_consumption * 100
        )
        extra_start_range_km = (
            electric_range_km
            if vehicle.fuel_type == "plug_in_hybrid" and electric_range_km
            else 0.0
        )
        refill_percent = refill_to_percent if refill_to_percent is not None else 100

    if refill_percent <= reserve_percent:
        raise ValueError(
            "Refill level must be higher than the reserve level"
        )

    return VehicleEnergyProfile(
        mode=mode,
        full_range_km=full_range_km,
        initial_range_km=(
            full_range_km * start_level_percent / 100
            + extra_start_range_km
        ),
        refill_range_km=full_range_km * refill_percent / 100,
        reserve_km=full_range_km * reserve_percent / 100,
    )


def cumulative_distances(
    coordinates: list[tuple[float, float]],
) -> list[float]:
    """
    Distance from the start (km) at each (latitude, longitude) point.
    """

    distances = [0.0]

    for previous, current in zip(coordinates, coordinates[1:]):
        distances.append(
            distances[-1]
            + calculate_distance_km(*previous, *current)
        )

    return distances


def point_at_distance(
    coordinates: list[tuple[float, float]],
    distances: list[float],
    distance_km: float,
) -> tuple[float, float]:
    """
    The route point closest to `distance_km` from the start.
    """

    index = min(bisect_left(distances, distance_km), len(coordinates) - 1)

    return coordinates[index]


def search_levels(reserve_percent: float) -> list[tuple[float, int]]:
    """
    (level %, largest radius km) to try for each stop, in order: the reserve
    level, then earlier (fuller) up to 40%, then later (emptier) down to 5%.
    """

    earlier = [reserve_percent]
    while earlier[-1] + LEVEL_STEP_PERCENT <= EARLIEST_LEVEL_PERCENT + 1e-9:
        earlier.append(earlier[-1] + LEVEL_STEP_PERCENT)

    later = []
    level = reserve_percent - LEVEL_STEP_PERCENT
    while level >= LATEST_LEVEL_PERCENT - 1e-9:
        later.append(level)
        level -= LEVEL_STEP_PERCENT

    return [(level, EARLY_MAX_RADIUS_KM) for level in earlier] + [
        (level, LATE_MAX_RADIUS_KM) for level in later
    ]


def plan_energy_stops(
    route_coordinates: list[tuple[float, float]],
    profile: VehicleEnergyProfile,
    find_stations: StationFinder,
) -> EnergyPlan:
    """
    Walk along the route and plan a stop wherever the tank / battery would
    drop to the reserve level. See search_levels for where stations are
    looked for; after each stop the vehicle is refilled.

    `route_coordinates` are (latitude, longitude) pairs.
    """

    if len(route_coordinates) < 2:
        raise ValueError("At least two route coordinates are required")

    if profile.refill_range_km - profile.reserve_km <= 0:
        raise ValueError(
            "Refill level must be higher than the reserve level"
        )

    distances = cumulative_distances(route_coordinates)
    total_km = distances[-1]
    reserve_percent = profile.reserve_km / profile.full_range_km * 100
    levels = search_levels(reserve_percent)

    stops: list[EnergyStop] = []
    warnings: list[str] = []
    # Route points (km) where the station service didn't answer.
    busy: list[float] = []

    position_km = 0.0
    range_left_km = profile.initial_range_km

    while True:
        reach_km = position_km + range_left_km - profile.reserve_km

        if reach_km >= total_km:
            break

        if len(stops) >= MAX_STOPS:
            warnings.append(
                "Too many stops to plan; check the vehicle's range"
            )
            break

        stop = _find_stop(
            route_coordinates,
            distances,
            position_km=position_km,
            range_left_km=range_left_km,
            full_range_km=profile.full_range_km,
            total_km=total_km,
            levels=levels,
            find_stations=find_stations,
            busy=busy,
        )

        if stop is None:
            target_km = max(reach_km, position_km)
            latitude, longitude = point_at_distance(
                route_coordinates, distances, target_km
            )
            stop = EnergyStop(
                distance_from_start_km=target_km,
                latitude=latitude,
                longitude=longitude,
                station=None,
                distance_from_route_km=None,
                level_percent=round(reserve_percent, 1),
            )
            warnings.append(
                f"No station found near km {round(target_km)}, even "
                f"looking from {round(EARLIEST_LEVEL_PERCENT)}% down to "
                f"{round(LATEST_LEVEL_PERCENT)}% left"
            )

        if stop.station is None and busy:
            warnings.append(
                "The station search service was busy; try again in a minute "
                "for a complete plan"
            )

        stops.append(stop)
        position_km = stop.distance_from_start_km
        range_left_km = profile.refill_range_km

    return EnergyPlan(
        total_distance_km=total_km,
        stops=stops,
        warnings=warnings,
    )


def _find_stop(
    coordinates: list[tuple[float, float]],
    distances: list[float],
    position_km: float,
    range_left_km: float,
    full_range_km: float,
    total_km: float,
    levels: list[tuple[float, int]],
    find_stations: StationFinder,
    busy: list[float],
) -> EnergyStop | None:
    """
    Try each (level, max radius) in turn: the route point where the level
    would be reached, then the nearest station within 1, 2, ... max radius
    km. One search at the largest radius gives the same answer as growing
    it 1 km at a time: the nearest station's distance decides the smallest
    radius that contains it.
    """

    searched: set[tuple[int, int]] = set()

    for level_percent, max_radius_km in levels:
        candidate_km = (
            position_km + range_left_km - full_range_km * level_percent / 100
        )

        # Already below this level (e.g. a low start): look where we are.
        if candidate_km < position_km:
            candidate_km = position_km
            level_percent = range_left_km / full_range_km * 100

        if candidate_km >= total_km:
            continue

        index = min(bisect_left(distances, candidate_km), len(coordinates) - 1)

        if (index, max_radius_km) in searched:
            continue
        searched.add((index, max_radius_km))

        latitude, longitude = coordinates[index]

        try:
            found = find_stations(latitude, longitude, max_radius_km)
        except httpx.HTTPError:
            # The station service is busy: try the next level instead of
            # failing the whole plan.
            busy.append(candidate_km)
            continue

        nearby = sorted(
            (
                (
                    calculate_distance_km(
                        latitude, longitude, station.latitude, station.longitude
                    ),
                    station,
                )
                for station in found
            ),
            key=lambda pair: pair[0],
        )

        if nearby and nearby[0][0] <= max_radius_km:
            distance_km, station = nearby[0]

            return EnergyStop(
                distance_from_start_km=candidate_km,
                latitude=latitude,
                longitude=longitude,
                station=station,
                distance_from_route_km=distance_km,
                level_percent=round(level_percent, 1),
                search_radius_km=max(1, math.ceil(distance_km)),
            )

    return None
