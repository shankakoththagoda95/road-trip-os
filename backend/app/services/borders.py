from dataclasses import dataclass


@dataclass
class BorderCrossing:
    from_country: str
    to_country: str
    location: tuple[float, float] | None = None

    def __post_init__(self) -> None:
        if not self.from_country.strip():
            raise ValueError("From country cannot be empty")

        if not self.to_country.strip():
            raise ValueError("To country cannot be empty")

        if self.location is not None:
            latitude, longitude = self.location

            if not -90 <= latitude <= 90:
                raise ValueError("Invalid latitude")

            if not -180 <= longitude <= 180:
                raise ValueError("Invalid longitude")


class BorderProvider:
    def get_countries(
        self,
        route_coordinates: list[tuple[float, float]],
    ) -> list[str]:
        return []


@dataclass
class BorderCalculation:
    countries: list[str]
    crossings: list[BorderCrossing]


def detect_border_crossings(
    countries: list[str],
) -> list[BorderCrossing]:
    crossings: list[BorderCrossing] = []

    for index in range(len(countries) - 1):
        from_country = countries[index]
        to_country = countries[index + 1]
    
        if not from_country.strip() or not to_country.strip():
            raise ValueError("Country cannot be empty")
    
        if from_country != to_country:
            crossings.append(
                BorderCrossing(
                    from_country=from_country,
                    to_country=to_country,
                    location=None,
                )
            )

    return crossings


def calculate_route_borders(
    route_coordinates: list[tuple[float, float]],
    provider: BorderProvider,
) -> BorderCalculation:
    for latitude, longitude in route_coordinates:
        if not -90 <= latitude <= 90:
            raise ValueError("Invalid latitude")

        if not -180 <= longitude <= 180:
            raise ValueError("Invalid longitude")

    countries = provider.get_countries(route_coordinates)
    crossings = detect_border_crossings(countries)

    return BorderCalculation(
        countries=countries,
        crossings=crossings,
    )