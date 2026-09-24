from bisect import bisect_left
from collections.abc import Callable
from dataclasses import dataclass, field

from app.models.vehicle import Vehicle
from app.services.geography import calculate_distance_km


# How far back along the route to move when no station is found near the
# ideal stop point, and how many times to try.
BACKOFF_STEP_KM = 20.0
MAX_SEARCH_ATTEMPTS = 4

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


StationFinder = Callable[[float, float], list[EnergyStation]]


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


def plan_energy_stops(
    route_coordinates: list[tuple[float, float]],
    profile: VehicleEnergyProfile,
    find_stations: StationFinder,
) -> EnergyPlan:
    """
    Walk along the route and plan a stop wherever the remaining range would
    drop into the reserve. Each stop uses the station closest to the route
    near that point; if none is found, earlier points are tried.

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

    stops: list[EnergyStop] = []
    warnings: list[str] = []

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

        target_km = max(reach_km, position_km)
        stop = _find_stop(
            route_coordinates,
            distances,
            target_km,
            earliest_km=position_km,
            find_stations=find_stations,
        )

        if stop.station is None:
            warnings.append(
                f"No station found near km {round(target_km)}"
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
    target_km: float,
    earliest_km: float,
    find_stations: StationFinder,
) -> EnergyStop:
    for attempt in range(MAX_SEARCH_ATTEMPTS):
        candidate_km = target_km - attempt * BACKOFF_STEP_KM

        if candidate_km < earliest_km:
            break

        latitude, longitude = point_at_distance(
            coordinates,
            distances,
            candidate_km,
        )
        stations = find_stations(latitude, longitude)

        if stations:
            station, distance_km = min(
                (
                    (
                        station,
                        calculate_distance_km(
                            latitude,
                            longitude,
                            station.latitude,
                            station.longitude,
                        ),
                    )
                    for station in stations
                ),
                key=lambda pair: pair[1],
            )

            return EnergyStop(
                distance_from_start_km=candidate_km,
                latitude=latitude,
                longitude=longitude,
                station=station,
                distance_from_route_km=distance_km,
            )

    latitude, longitude = point_at_distance(coordinates, distances, target_km)

    return EnergyStop(
        distance_from_start_km=target_km,
        latitude=latitude,
        longitude=longitude,
        station=None,
        distance_from_route_km=None,
    )
