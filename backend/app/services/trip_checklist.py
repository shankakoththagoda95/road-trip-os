"""
Country-aware travel checklist for a road trip.

Rules reflect commonly cited requirements for passenger cars (2025) and
change over time - the checklist tells travellers to confirm them before
leaving. Items that depend on nationality (e.g. International Driving
Permit) are shown as optional with an explanation.
"""

from dataclasses import dataclass, field
from datetime import date, timedelta

from app.services.road_fees import COUNTRY_RULES


@dataclass
class ChecklistItem:
    # Stable id so the client can remember what's ticked.
    id: str
    category: str  # documents | payments | equipment | winter | rules | vehicle
    name: str
    description: str
    required: bool
    country_codes: list[str] = field(default_factory=list)


# EU, EEA, Switzerland and microstates: no Green Card needed between them,
# and one insurance certificate covers all.
EU_EEA_CH = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
    "SI", "ES", "SE", "IS", "LI", "NO", "CH", "AD", "MC", "SM", "VA", "GB",
}

REFLECTIVE_VEST = {
    "AT", "BA", "BE", "BG", "HR", "CZ", "DE", "ES", "FR", "HU", "IT", "LU",
    "ME", "MK", "NO", "PT", "RO", "RS", "SI", "SK",
}
WARNING_TRIANGLE = {
    "AT", "BA", "BE", "BG", "CH", "CZ", "DE", "ES", "FR", "GR", "HR", "HU",
    "IT", "LU", "ME", "MK", "NO", "PL", "PT", "RO", "RS", "SI", "SK",
}
FIRST_AID_KIT = {
    "AT", "BA", "BG", "CZ", "DE", "GR", "HR", "ME", "MK", "RO", "RS", "SI",
    "SK",
}
FIRE_EXTINGUISHER = {"BA", "BG", "GR", "MK", "PL", "RO", "TR"}
SPARE_BULBS = {"HR", "ME", "MK", "RS"}

DAYTIME_HEADLIGHTS = {
    "BA", "BG", "CZ", "DK", "EE", "FI", "HR", "HU", "IS", "IT", "LT", "LV",
    "ME", "MK", "NO", "PL", "RO", "RS", "SE", "SI", "SK",
}
DRIVE_ON_LEFT = {"GB", "IE", "CY", "MT"}

# Winter tyre rules: months when they apply (by law or by conditions).
WINTER_TYRE_MONTHS = {
    "AT": {11, 12, 1, 2, 3, 4},
    "CZ": {11, 12, 1, 2, 3},
    "DE": {10, 11, 12, 1, 2, 3, 4},
    "EE": {12, 1, 2, 3},
    "FI": {12, 1, 2},
    "FR": {11, 12, 1, 2, 3},
    "HR": {11, 12, 1, 2, 3, 4},
    "IT": {11, 12, 1, 2, 3, 4},
    "LT": {11, 12, 1, 2, 3},
    "LV": {12, 1, 2, 3},
    "NO": {11, 12, 1, 2, 3, 4},
    "RO": {11, 12, 1, 2, 3},
    "SE": {12, 1, 2, 3},
    "SI": {11, 12, 1, 2, 3},
    "SK": {11, 12, 1, 2, 3},
}
SNOW_CHAIN_COUNTRIES = {"AT", "CH", "FR", "IT", "AD"}
SNOW_CHAIN_MONTHS = {11, 12, 1, 2, 3, 4}

LOW_EMISSION_STICKERS = {
    "FR": (
        "Crit'Air emissions sticker",
        "Needed to drive in low-emission zones in Paris, Lyon, Grenoble "
        "and other French cities. Order only from certificat-air.gouv.fr.",
    ),
    "DE": (
        "Umweltplakette (environmental badge)",
        "Needed in the low-emission zones of many German cities.",
    ),
    "BE": (
        "Low-emission zone registration",
        "Foreign vehicles must register before entering Brussels, Antwerp "
        "or Ghent.",
    ),
}

CATEGORY_ORDER = ["documents", "payments", "equipment", "winter", "rules", "vehicle"]


def trip_months(departure: date, duration_days: int) -> set[int]:
    return {
        (departure + timedelta(days=offset)).month
        for offset in range(max(1, duration_days))
    }


def _in(codes: set[str], countries: list[str]) -> list[str]:
    """Countries on the route that are in `codes`, in route order."""

    return [code for code in countries if code in codes]


def _list(codes: list[str]) -> str:
    return ", ".join(codes)


def build_trip_checklist(
    country_codes: list[str],
    departure: date,
    duration_days: int,
    vehicle_type: str | None = None,
    fuel_type: str | None = None,
) -> list[ChecklistItem]:
    """
    Items to prepare for a trip through `country_codes` (route order).
    """

    countries = list(dict.fromkeys(code.upper() for code in country_codes))
    months = trip_months(departure, duration_days)
    international = len(countries) > 1

    items: list[ChecklistItem] = []

    # --- Documents ---
    items += [
        ChecklistItem(
            "driving-licence",
            "documents",
            "Driving licence",
            "A valid, full licence for every driver.",
            required=True,
        ),
        ChecklistItem(
            "vehicle-registration",
            "documents",
            "Vehicle registration document",
            "The original, plus a letter of authorisation if the car isn't "
            "yours (e.g. a company or borrowed car).",
            required=True,
        ),
        ChecklistItem(
            "insurance-certificate",
            "documents",
            "Motor insurance certificate",
            "Check your policy covers every country on the route.",
            required=True,
        ),
    ]

    if international:
        items.append(
            ChecklistItem(
                "passport-or-id",
                "documents",
                "Passport or national ID card",
                "Needed for border checks. Within Schengen, carry it "
                "anyway: spot checks happen.",
                required=True,
                country_codes=countries,
            )
        )
        items.append(
            ChecklistItem(
                "international-driving-permit",
                "documents",
                "International Driving Permit",
                "Only if your licence wasn't issued in the EU/EEA, UK or "
                "Switzerland.",
                required=False,
            )
        )
        items.append(
            ChecklistItem(
                "travel-insurance",
                "documents",
                "Travel & health insurance",
                "EU citizens: bring your EHIC card too.",
                required=False,
            )
        )

    green_card = [code for code in countries if code not in EU_EEA_CH]

    if green_card:
        items.append(
            ChecklistItem(
                "green-card",
                "documents",
                "Green Card (international insurance proof)",
                f"Ask your insurer for proof of cover in {_list(green_card)}.",
                required=True,
                country_codes=green_card,
            )
        )

    # --- Payments: vignettes and toll registrations ---
    for code in countries:
        rule = COUNTRY_RULES.get(code)

        if rule is None:
            continue

        if rule.kind == "vignette":
            items.append(
                ChecklistItem(
                    f"vignette-{code.lower()}",
                    "payments",
                    f"Buy the {rule.name}",
                    f"{rule.note} Required before you drive on motorways "
                    f"({rule.url}).",
                    required=True,
                    country_codes=[code],
                )
            )
        elif rule.kind == "toll_stations":
            items.append(
                ChecklistItem(
                    f"toll-registration-{code.lower()}",
                    "payments",
                    f"Register for {rule.name}",
                    f"{rule.note} ({rule.url})",
                    required=False,
                    country_codes=[code],
                )
            )

    toll_booths = [
        code
        for code in countries
        if code in COUNTRY_RULES and COUNTRY_RULES[code].kind == "distance"
    ]

    if toll_booths:
        items.append(
            ChecklistItem(
                "toll-payment",
                "payments",
                "Card or cash for toll booths",
                f"Motorway tolls are paid on the road in {_list(toll_booths)}.",
                required=False,
                country_codes=toll_booths,
            )
        )

    if "PT" in countries:
        items.append(
            ChecklistItem(
                "portugal-electronic-tolls",
                "payments",
                "Set up Portuguese electronic tolls",
                "Some motorways have no booths. Register your card with "
                "EasyToll at the border or rent a Via Verde device.",
                required=True,
                country_codes=["PT"],
            )
        )

    # --- Equipment ---
    for item_id, name, codes, description in [
        (
            "reflective-vests",
            "Reflective vests",
            REFLECTIVE_VEST,
            "One per occupant, reachable from inside the car (not in the "
            "boot).",
        ),
        (
            "warning-triangle",
            "Warning triangle",
            WARNING_TRIANGLE,
            "To place behind the car after a breakdown or accident.",
        ),
        (
            "first-aid-kit",
            "First-aid kit",
            FIRST_AID_KIT,
            "Check it's complete and not expired.",
        ),
        (
            "fire-extinguisher",
            "Fire extinguisher",
            FIRE_EXTINGUISHER,
            "Mounted within reach of the driver.",
        ),
        (
            "spare-bulbs",
            "Spare bulb kit",
            SPARE_BULBS,
            "Unless your lights are LED or xenon.",
        ),
    ]:
        required_in = _in(codes, countries)

        if required_in:
            items.append(
                ChecklistItem(
                    item_id,
                    "equipment",
                    name,
                    f"Required in {_list(required_in)}. {description}",
                    required=True,
                    country_codes=required_in,
                )
            )

    for code in countries:
        if code in LOW_EMISSION_STICKERS:
            name, description = LOW_EMISSION_STICKERS[code]
            items.append(
                ChecklistItem(
                    f"low-emission-{code.lower()}",
                    "equipment",
                    name,
                    description,
                    required=False,
                    country_codes=[code],
                )
            )

    if "FR" in countries:
        items.append(
            ChecklistItem(
                "breathalyser",
                "equipment",
                "Breathalyser",
                "Technically required in France, though not fined.",
                required=False,
                country_codes=["FR"],
            )
        )

    # --- Winter ---
    winter_tyres = [
        code
        for code in countries
        if months & WINTER_TYRE_MONTHS.get(code, set())
    ]

    if winter_tyres:
        items.append(
            ChecklistItem(
                "winter-tyres",
                "winter",
                "Winter tyres",
                f"Required (by date or in wintry conditions) in "
                f"{_list(winter_tyres)} during your travel dates.",
                required=True,
                country_codes=winter_tyres,
            )
        )

    snow_chains = _in(SNOW_CHAIN_COUNTRIES, countries)

    if snow_chains and months & SNOW_CHAIN_MONTHS:
        items.append(
            ChecklistItem(
                "snow-chains",
                "winter",
                "Snow chains",
                f"Carry them for mountain roads in {_list(snow_chains)}; "
                "signs show when they're mandatory.",
                required=False,
                country_codes=snow_chains,
            )
        )

    if winter_tyres or (snow_chains and months & SNOW_CHAIN_MONTHS):
        items.append(
            ChecklistItem(
                "winter-kit",
                "winter",
                "Ice scraper, de-icer and winter washer fluid",
                "Plus warm clothes and a blanket in case you get stuck.",
                required=False,
            )
        )

    # --- Driving rules ---
    headlights = _in(DAYTIME_HEADLIGHTS, countries)

    if headlights:
        items.append(
            ChecklistItem(
                "daytime-headlights",
                "rules",
                "Headlights on during the day",
                f"Dipped headlights (or daytime running lights) are required "
                f"at all times in {_list(headlights)}.",
                required=True,
                country_codes=headlights,
            )
        )

    left = _in(DRIVE_ON_LEFT, countries)

    if left:
        items.append(
            ChecklistItem(
                "drive-on-left",
                "rules",
                "Headlamp beam deflectors",
                f"Traffic drives on the left in {_list(left)}. Adjust or "
                "cover your headlights if your car is built for the right.",
                required=True,
                country_codes=left,
            )
        )

    if international:
        items.append(
            ChecklistItem(
                "country-identifier",
                "rules",
                "Country identifier",
                "Needed abroad unless your number plate already shows your "
                "country code (e.g. the EU plate band).",
                required=False,
            )
        )

    # --- Vehicle ---
    if fuel_type in {"electric", "plug_in_hybrid"}:
        items += [
            ChecklistItem(
                "charging-cards",
                "vehicle",
                "Charging cards or apps",
                "A roaming charge card or the apps for networks along the "
                "route.",
                required=False,
            ),
            ChecklistItem(
                "charging-cable",
                "vehicle",
                "Type 2 charging cable",
                "For AC chargers without a tethered cable.",
                required=False,
            ),
        ]

    if vehicle_type == "campervan":
        items.append(
            ChecklistItem(
                "vehicle-weight",
                "vehicle",
                "Check your vehicle's weight class",
                "Over 3.5 t pays different tolls (GO-Box in Austria, LSVA in "
                "Switzerland) and may face lower speed limits.",
                required=False,
            )
        )

    items.append(
        ChecklistItem(
            "breakdown-cover",
            "vehicle",
            "European breakdown cover",
            "Check your roadside assistance works abroad.",
            required=False,
        )
    )

    return sorted(
        items,
        key=lambda item: CATEGORY_ORDER.index(item.category),
    )
