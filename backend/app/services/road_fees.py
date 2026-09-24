"""
Road fees along a route, from per-country rules and known toll crossings.

Prices are approximate passenger-car prices (2025), converted to EUR, and
change every year - every fee links to its official source and is flagged
as an estimate. Heavier vehicles (campervans over 3.5 t) pay different
tolls in several countries.
"""

from dataclasses import dataclass

from app.services.geography import calculate_distance_km
from app.services.route_countries import CountryStretch


@dataclass(frozen=True)
class CountryFeeRule:
    kind: str  # "vignette" | "distance" | "toll_stations" | "info"
    name: str
    note: str
    url: str
    # Fixed price for vignettes.
    amount_eur: float | None = None
    # Rough average for distance-based motorway tolls.
    rate_eur_per_km: float | None = None


@dataclass(frozen=True)
class FixedToll:
    name: str
    country_code: str
    # A point on the road (taken from OSRM routes through each one).
    latitude: float
    longitude: float
    amount_eur: float
    url: str


@dataclass
class RoadFee:
    name: str
    country_code: str
    kind: str  # "vignette" | "distance" | "toll_stations" | "crossing" | "info"
    amount_eur: float | None
    note: str
    url: str | None


COUNTRY_RULES: dict[str, CountryFeeRule] = {
    # --- Vignettes (time-based, required on motorways) ---
    "AT": CountryFeeRule(
        "vignette",
        "Austrian motorway vignette",
        "10-day digital vignette. Buy it online at least 18 days ahead, or "
        "at a petrol station.",
        "https://shop.asfinag.at",
        amount_eur=12.8,
    ),
    "CH": CountryFeeRule(
        "vignette",
        "Swiss motorway vignette",
        "Annual vignette (CHF 40), the only option. The e-vignette is "
        "linked to your number plate.",
        "https://via.admin.ch",
        amount_eur=43.0,
    ),
    "CZ": CountryFeeRule(
        "vignette",
        "Czech e-vignette",
        "10-day e-vignette (about CZK 290).",
        "https://edalnice.cz",
        amount_eur=12.0,
    ),
    "SK": CountryFeeRule(
        "vignette",
        "Slovak e-vignette",
        "10-day e-vignette.",
        "https://eznamka.sk",
        amount_eur=12.0,
    ),
    "SI": CountryFeeRule(
        "vignette",
        "Slovenian e-vignette",
        "7-day e-vignette.",
        "https://evinjeta.dars.si",
        amount_eur=16.0,
    ),
    "HU": CountryFeeRule(
        "vignette",
        "Hungarian e-vignette",
        "10-day e-vignette (about HUF 6,900).",
        "https://ematrica.nemzetiutdij.hu",
        amount_eur=17.5,
    ),
    "RO": CountryFeeRule(
        "vignette",
        "Romanian rovinieta",
        "7-day rovinieta, required on all national roads.",
        "https://www.roviniete.ro",
        amount_eur=3.0,
    ),
    "BG": CountryFeeRule(
        "vignette",
        "Bulgarian e-vignette",
        "Weekly e-vignette (about BGN 15).",
        "https://bgtoll.bg",
        amount_eur=8.0,
    ),
    "MD": CountryFeeRule(
        "vignette",
        "Moldovan road vignette",
        "7-day vignette, required for foreign-registered cars.",
        "https://vinieta.gov.md",
        amount_eur=4.0,
    ),
    # --- Distance-based motorway tolls ---
    "FR": CountryFeeRule(
        "distance",
        "French motorway tolls (péage)",
        "Most autoroutes are tolled; pay at booths or with a tag.",
        "https://www.autoroutes.fr",
        rate_eur_per_km=0.09,
    ),
    "IT": CountryFeeRule(
        "distance",
        "Italian motorway tolls (autostrada)",
        "Most autostrade are tolled; pay at booths when leaving.",
        "https://www.autostrade.it",
        rate_eur_per_km=0.08,
    ),
    "ES": CountryFeeRule(
        "distance",
        "Spanish motorway tolls (autopista de peaje)",
        "Only some autopistas (AP-) are tolled; many are now free.",
        "https://www.dgt.es",
        rate_eur_per_km=0.04,
    ),
    "PT": CountryFeeRule(
        "distance",
        "Portuguese motorway tolls",
        "Some motorways are electronic-only: register your plate or rent "
        "a Via Verde device.",
        "https://www.portugaltolls.com",
        rate_eur_per_km=0.08,
    ),
    "HR": CountryFeeRule(
        "distance",
        "Croatian motorway tolls",
        "Pay at booths or with an ENC device.",
        "https://www.hac.hr",
        rate_eur_per_km=0.07,
    ),
    "GR": CountryFeeRule(
        "distance",
        "Greek motorway tolls",
        "Toll stations on most motorways.",
        "https://www.aodos.gr",
        rate_eur_per_km=0.06,
    ),
    "RS": CountryFeeRule(
        "distance",
        "Serbian motorway tolls",
        "Pay at toll stations (cash or card).",
        "https://www.putevi-srbije.rs",
        rate_eur_per_km=0.04,
    ),
    "PL": CountryFeeRule(
        "distance",
        "Polish motorway tolls",
        "Only parts of the A1, A2 and A4 are tolled (e-TOLL app).",
        "https://etoll.gov.pl",
        rate_eur_per_km=0.02,
    ),
    # --- Toll stations ---
    "NO": CountryFeeRule(
        "toll_stations",
        "Norwegian road tolls (AutoPASS)",
        "Automatic toll stations bill the number plate. Register with "
        "Epass24 to be invoiced.",
        "https://www.epass24.com",
        rate_eur_per_km=0.03,
    ),
    # --- No general road tolls, but worth knowing ---
    "SE": CountryFeeRule(
        "info",
        "Swedish congestion taxes",
        "No motorway tolls. Stockholm and Gothenburg charge congestion "
        "tax, billed to the number plate.",
        "https://www.transportstyrelsen.se",
    ),
    "GB": CountryFeeRule(
        "info",
        "UK crossings and charges",
        "Motorways are free except the M6 Toll. London has congestion "
        "and ULEZ charges; the Dartford Crossing is pay-online.",
        "https://www.gov.uk/pay-dartford-crossing-charge",
    ),
    "IE": CountryFeeRule(
        "info",
        "Irish motorway tolls",
        "Several motorways have toll plazas; the M50 around Dublin is "
        "barrier-free and must be paid online.",
        "https://www.eflow.ie",
    ),
}

FIXED_TOLLS: list[FixedToll] = [
    FixedToll("Øresund Bridge", "DK", 55.5769, 12.8189, 63.0, "https://www.oresundsbron.com"),
    FixedToll("Great Belt Bridge", "DK", 55.3393, 11.0149, 37.0, "https://storebaelt.dk"),
    FixedToll("Mont Blanc Tunnel", "FR", 45.8628, 6.9042, 64.0, "https://www.tunnelmb.net"),
    FixedToll("Fréjus Road Tunnel", "FR", 45.1279, 6.6922, 60.0, "https://www.sftrf.fr"),
    FixedToll("Great St Bernard Tunnel", "CH", 45.8453, 7.1709, 36.0, "https://www.letunnel.com"),
    FixedToll("Brenner motorway (A13)", "AT", 47.2154, 11.3971, 12.5, "https://www.asfinag.at"),
    FixedToll("Arlberg Road Tunnel", "AT", 47.1261, 10.2140, 11.5, "https://www.asfinag.at"),
    FixedToll("Tauern & Katschberg tunnels (A10)", "AT", 47.1986, 13.4287, 14.5, "https://www.asfinag.at"),
    FixedToll("Karawanken Tunnel", "AT", 46.4833, 14.0102, 8.5, "https://www.asfinag.at"),
    FixedToll("Svinesund Bridge", "NO", 59.0923, 11.2522, 2.5, "https://www.autopass.no"),
]

# How close the route must pass to a fixed toll's point.
FIXED_TOLL_RADIUS_KM = 1.5

HEAVY_VEHICLE_NOTE = (
    "Campervans over 3.5 t pay different tolls in several countries "
    "(e.g. GO-Box in Austria, LSVA in Switzerland). These estimates are "
    "for vehicles up to 3.5 t."
)


def fixed_tolls_on_route(
    route_coordinates: list[tuple[float, float]],
) -> list[FixedToll]:
    """
    Known bridges and tunnels the route passes through, in route order.
    """

    found: list[tuple[int, FixedToll]] = []

    for toll in FIXED_TOLLS:
        for index, (latitude, longitude) in enumerate(route_coordinates):
            # Cheap bounding check before the exact distance.
            if (
                abs(latitude - toll.latitude) > 0.05
                or abs(longitude - toll.longitude) > 0.1
            ):
                continue

            if (
                calculate_distance_km(
                    latitude,
                    longitude,
                    toll.latitude,
                    toll.longitude,
                )
                <= FIXED_TOLL_RADIUS_KM
            ):
                found.append((index, toll))
                break

    return [toll for _, toll in sorted(found, key=lambda pair: pair[0])]


def calculate_road_fees(
    stretches: list[CountryStretch],
    route_coordinates: list[tuple[float, float]],
) -> list[RoadFee]:
    """
    Fees for each country driven through (once per country, in route
    order), then fixed-price bridges and tunnels.
    """

    km_per_country: dict[str, float] = {}
    order: list[str] = []

    for stretch in stretches:
        code = stretch.country.code

        if code not in km_per_country:
            order.append(code)
            km_per_country[code] = 0.0

        km_per_country[code] += stretch.distance_km

    fees: list[RoadFee] = []

    for code in order:
        rule = COUNTRY_RULES.get(code)

        if rule is None:
            continue

        if rule.rate_eur_per_km is not None:
            amount = round(rule.rate_eur_per_km * km_per_country[code], 2)
            note = (
                f"{rule.note} Rough estimate for "
                f"{round(km_per_country[code])} km."
            )
        else:
            amount = rule.amount_eur
            note = rule.note

        fees.append(
            RoadFee(
                name=rule.name,
                country_code=code,
                kind=rule.kind,
                amount_eur=amount,
                note=note,
                url=rule.url,
            )
        )

    for toll in fixed_tolls_on_route(route_coordinates):
        fees.append(
            RoadFee(
                name=toll.name,
                country_code=toll.country_code,
                kind="crossing",
                amount_eur=toll.amount_eur,
                note="One-way, passenger car.",
                url=toll.url,
            )
        )

    return fees
