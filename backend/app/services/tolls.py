from dataclasses import dataclass, field


@dataclass
class TollFee:
    name: str
    country: str
    amount: float
    currency: str

    def __post_init__(self) -> None:
        if self.amount < 0:
            raise ValueError("Toll amount cannot be negative")

        if not self.currency.strip():
            raise ValueError("Currency cannot be empty")

        if not self.name.strip():
            raise ValueError("Toll name cannot be empty")

        if not self.country.strip():
            raise ValueError("Country cannot be empty")


def calculate_toll_total(fees: list[TollFee]) -> float:
    return sum(fee.amount for fee in fees)


@dataclass
class TollCalculation:
    fees: list[TollFee]
    currency: str
    total_amount: float = field(init=False)

    def __post_init__(self) -> None:
        if not self.currency.strip():
            raise ValueError("Currency cannot be empty")

        currencies = {fee.currency for fee in self.fees}

        if currencies and currencies != {self.currency}:
            raise ValueError("All toll fees must use the same currency")

        self.total_amount = calculate_toll_total(self.fees)


class TollProvider:
    def get_tolls(
        self,
        route_coordinates: list[tuple[float, float]],
    ) -> list[TollFee]:
        return []


def calculate_route_tolls(
    route_coordinates: list[tuple[float, float]],
    provider: TollProvider,
    currency: str,
) -> TollCalculation:
    for latitude, longitude in route_coordinates:
        if not -90 <= latitude <= 90:
            raise ValueError("Invalid latitude")

        if not -180 <= longitude <= 180:
            raise ValueError("Invalid longitude")

    fees = provider.get_tolls(route_coordinates)

    return TollCalculation(
        fees=fees,
        currency=currency,
    )