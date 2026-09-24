import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


# Natural Earth 1:50m country boundaries (public domain), trimmed to
# ISO code + name. Accurate to a few hundred metres, which is plenty for
# telling which country a road is in.
COUNTRIES_PATH = Path(__file__).resolve().parent.parent / "data" / "countries.geojson"


@dataclass(frozen=True)
class Country:
    code: str
    name: str


@dataclass
class _Polygon:
    country: Country
    # Outer ring first, then holes. Points are (longitude, latitude).
    rings: list[list[tuple[float, float]]]
    bbox: tuple[float, float, float, float]  # min lon, min lat, max lon, max lat


def _point_in_ring(
    longitude: float,
    latitude: float,
    ring: list[tuple[float, float]],
) -> bool:
    """
    Ray casting: count how many ring edges a ray to the east crosses.
    """

    inside = False
    j = len(ring) - 1

    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]

        if (yi > latitude) != (yj > latitude):
            crossing_x = xi + (latitude - yi) * (xj - xi) / (yj - yi)

            if longitude < crossing_x:
                inside = not inside

        j = i

    return inside


class CountryLocator:
    """
    Offline lookup of the country containing a coordinate.
    """

    def __init__(self, path: Path = COUNTRIES_PATH):
        data = json.loads(path.read_text(encoding="utf-8"))

        self.polygons: list[_Polygon] = []

        for feature in data["features"]:
            properties = feature["properties"]
            country = Country(code=properties["code"], name=properties["name"])
            geometry = feature["geometry"]

            polygons = (
                [geometry["coordinates"]]
                if geometry["type"] == "Polygon"
                else geometry["coordinates"]
            )

            for polygon in polygons:
                rings = [
                    [(point[0], point[1]) for point in ring]
                    for ring in polygon
                ]
                outer = rings[0]
                self.polygons.append(
                    _Polygon(
                        country=country,
                        rings=rings,
                        bbox=(
                            min(point[0] for point in outer),
                            min(point[1] for point in outer),
                            max(point[0] for point in outer),
                            max(point[1] for point in outer),
                        ),
                    )
                )

    def by_code(self, code: str) -> Country | None:
        return next(
            (
                polygon.country
                for polygon in self.polygons
                if polygon.country.code == code
            ),
            None,
        )

    def locate(self, latitude: float, longitude: float) -> Country | None:
        """
        The country at a point, or None at sea / outside every boundary.
        """

        for polygon in self.polygons:
            min_lon, min_lat, max_lon, max_lat = polygon.bbox

            if not (
                min_lon <= longitude <= max_lon
                and min_lat <= latitude <= max_lat
            ):
                continue

            outer, *holes = polygon.rings

            if _point_in_ring(longitude, latitude, outer) and not any(
                _point_in_ring(longitude, latitude, hole) for hole in holes
            ):
                return polygon.country

        return None


@lru_cache(maxsize=1)
def get_country_locator() -> CountryLocator:
    """
    Shared locator; the boundary file is only parsed once.
    """

    return CountryLocator()
