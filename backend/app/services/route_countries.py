import time
from collections.abc import Callable
from dataclasses import dataclass

import httpx

from app.integrations.countries import Country, CountryLocator
from app.services.borders import BorderProvider
from app.services.energy_stops import cumulative_distances, point_at_distance


# Distance between samples along the route.
SAMPLE_STEP_KM = 2.0

# Runs shorter than this between two stretches of the same country are
# treated as noise (roads that hug a border, simplified boundaries).
MIN_RUN_KM = 3.0

# Stretches shorter than this are double-checked with a reverse geocoder:
# at 1:50m, boundaries can be off by a kilometre or two, which matters for
# roads running alongside a border (e.g. the Swiss A13 next to
# Liechtenstein).
VERIFY_BELOW_KM = 25.0
MAX_VERIFICATIONS = 6

# Returns the ISO alpha-2 code at (latitude, longitude), or None.
CountryVerifier = Callable[[float, float], str | None]


@dataclass
class CountryStretch:
    country: Country
    start_km: float
    end_km: float
    # First sample inside this country.
    entry_point: tuple[float, float]

    @property
    def distance_km(self) -> float:
        return self.end_km - self.start_km


def country_stretches(
    route_coordinates: list[tuple[float, float]],
    locator: CountryLocator,
    step_km: float = SAMPLE_STEP_KM,
    verify_country: CountryVerifier | None = None,
) -> list[CountryStretch]:
    """
    Split a route of (latitude, longitude) points into consecutive
    stretches per country. Short stretches are re-checked with
    `verify_country` when given.
    """

    if len(route_coordinates) < 2:
        return []

    distances = cumulative_distances(route_coordinates)
    total_km = distances[-1]
    sample_count = max(2, int(total_km // step_km) + 1)

    samples: list[tuple[float, Country | None, tuple[float, float]]] = []

    for index in range(sample_count):
        distance_km = min(total_km, index * step_km)
        point = point_at_distance(route_coordinates, distances, distance_km)
        samples.append((distance_km, locator.locate(*point), point))

    if samples[-1][0] < total_km:
        point = route_coordinates[-1]
        samples.append((total_km, locator.locate(*point), point))

    # Points at sea (ferries) or just off a simplified coastline belong to
    # the previous country; leading unknowns take the first known one.
    first_known = next(
        (country for _, country, _ in samples if country is not None),
        None,
    )

    if first_known is None:
        return []

    stretches: list[CountryStretch] = []
    current = first_known

    for distance_km, country, point in samples:
        country = country or current

        if not stretches or stretches[-1].country != country:
            if stretches:
                stretches[-1].end_km = distance_km

            stretches.append(
                CountryStretch(
                    country=country,
                    start_km=distance_km,
                    end_km=distance_km,
                    entry_point=point,
                )
            )

        current = country

    stretches[-1].end_km = total_km
    stretches = _merge_short_runs(stretches)

    if verify_country is not None:
        stretches = _verify_short_stretches(
            stretches,
            route_coordinates,
            distances,
            locator,
            verify_country,
        )

    return stretches


def _verify_short_stretches(
    stretches: list[CountryStretch],
    route_coordinates: list[tuple[float, float]],
    distances: list[float],
    locator: CountryLocator,
    verify_country: CountryVerifier,
) -> list[CountryStretch]:
    checked = 0

    for stretch in stretches:
        if stretch.distance_km >= VERIFY_BELOW_KM or len(stretches) == 1:
            continue

        if checked >= MAX_VERIFICATIONS:
            break

        midpoint = point_at_distance(
            route_coordinates,
            distances,
            (stretch.start_km + stretch.end_km) / 2,
        )

        try:
            code = verify_country(*midpoint)
        except httpx.HTTPError:
            # Keep the offline answer if the service is unavailable.
            break

        checked += 1
        country = locator.by_code(code) if code else None

        if country is not None:
            stretch.country = country

    # Neighbours may now be the same country.
    merged: list[CountryStretch] = []

    for stretch in stretches:
        if merged and merged[-1].country == stretch.country:
            merged[-1].end_km = stretch.end_km
        else:
            merged.append(stretch)

    return merged


def throttled(
    verify_country: CountryVerifier,
    min_interval_seconds: float = 1.1,
) -> CountryVerifier:
    """
    Space calls out (Nominatim allows about one request per second).
    """

    last_call = [0.0]

    def call(latitude: float, longitude: float) -> str | None:
        wait = last_call[0] + min_interval_seconds - time.monotonic()

        if wait > 0:
            time.sleep(wait)

        last_call[0] = time.monotonic()

        return verify_country(latitude, longitude)

    return call


def _merge_short_runs(stretches: list[CountryStretch]) -> list[CountryStretch]:
    merged: list[CountryStretch] = []

    for stretch in stretches:
        if (
            len(merged) >= 2
            and merged[-1].distance_km < MIN_RUN_KM
            and merged[-2].country == stretch.country
        ):
            # A-B-A with a tiny B: fold B and this A into the first A.
            merged.pop()
            merged[-1].end_km = stretch.end_km
        elif merged and merged[-1].country == stretch.country:
            merged[-1].end_km = stretch.end_km
        else:
            merged.append(stretch)

    return merged


class NaturalEarthBorderProvider(BorderProvider):
    """
    Countries along a route, from offline Natural Earth boundaries.
    """

    def __init__(
        self,
        locator: CountryLocator,
        verify_country: CountryVerifier | None = None,
    ):
        self.locator = locator
        self.verify_country = verify_country

    def get_countries(
        self,
        route_coordinates: list[tuple[float, float]],
    ) -> list[str]:
        return [
            stretch.country.name
            for stretch in country_stretches(
                route_coordinates,
                self.locator,
                verify_country=self.verify_country,
            )
        ]
