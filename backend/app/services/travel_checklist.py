from dataclasses import dataclass


@dataclass
class TravelChecklistItem:
    name: str
    required: bool
    description: str

    def __post_init__(self) -> None:
        if not self.name.strip():
            raise ValueError("Checklist item name cannot be empty")

        if not self.description.strip():
            raise ValueError("Checklist item description cannot be empty")


@dataclass
class TravelChecklist:
    items: list[TravelChecklistItem]

    @property
    def required_items(self) -> list[TravelChecklistItem]:
        return [
            item for item in self.items
            if item.required
        ]

    @property
    def optional_items(self) -> list[TravelChecklistItem]:
        return [
            item for item in self.items
            if not item.required
        ]


def generate_travel_checklist(
    countries: list[str],
) -> TravelChecklist:
    for country in countries:
        if not country.strip():
            raise ValueError("Country cannot be empty")

    items: list[TravelChecklistItem] = []

    if len(countries) > 1:
        items.append(
            TravelChecklistItem(
                name="Passport",
                required=True,
                description="Valid passport required for international travel.",
            )
        )

        items.append(
            TravelChecklistItem(
                name="Travel Insurance",
                required=False,
                description="Recommended for international travel.",
            )
        )

    return TravelChecklist(items=items)