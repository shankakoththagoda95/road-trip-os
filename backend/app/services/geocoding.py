import httpx


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"


def search_location(location: str) -> dict:
    """
    Find the best match for a location name.

    Returns the matched display name and its coordinates.
    """

    params = {
        "q": location,
        "format": "jsonv2",
        "limit": 1,
    }

    headers = {
        "User-Agent": "Road-Trip-OS/1.0 (development project)",
    }

    response = httpx.get(
        NOMINATIM_URL,
        params=params,
        headers=headers,
        timeout=10,
    )

    response.raise_for_status()

    results = response.json()

    if not results:
        raise ValueError(
            f"Location not found: {location}"
        )

    return {
        "display_name": results[0]["display_name"],
        "latitude": float(results[0]["lat"]),
        "longitude": float(results[0]["lon"]),
    }


def reverse_country_code(latitude: float, longitude: float) -> str | None:
    """
    ISO 3166-1 alpha-2 code (upper case) of the country at a point, or None
    at sea.
    """

    response = httpx.get(
        NOMINATIM_REVERSE_URL,
        params={
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            # Country level is enough and cheapest.
            "zoom": 3,
        },
        headers={
            "User-Agent": "Road-Trip-OS/1.0 (development project)",
        },
        timeout=10,
    )

    response.raise_for_status()

    code = response.json().get("address", {}).get("country_code")

    return code.upper() if code else None


def geocode_location(location: str) -> tuple[float, float]:
    """
    Convert a location name into latitude and longitude.
    """

    result = search_location(location)

    return (
        result["latitude"],
        result["longitude"],
    )


# Nominatim allows about one request a second; positions a few hundred
# metres apart are the same town, so cache by rounded coordinates.
_place_cache: dict[tuple[float, float], dict | None] = {}
_PLACE_CACHE_SIZE = 500


def reverse_place(latitude: float, longitude: float) -> dict | None:
    """
    The town or city at a point: {"name", "region", "country",
    "country_code"}, or None where there's none (e.g. at sea).
    """

    key = (round(latitude, 2), round(longitude, 2))

    if key in _place_cache:
        return _place_cache[key]

    response = httpx.get(
        NOMINATIM_REVERSE_URL,
        params={
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            # Town / city level.
            "zoom": 10,
        },
        headers={
            "User-Agent": "Road-Trip-OS/1.0 (development project)",
        },
        timeout=10,
    )

    response.raise_for_status()

    address = response.json().get("address") or {}
    name = next(
        (
            address[key_name]
            for key_name in (
                "city",
                "town",
                "village",
                "municipality",
                "county",
                "state",
            )
            if address.get(key_name)
        ),
        None,
    )

    place = (
        {
            "name": name,
            "region": address.get("state"),
            "country": address.get("country"),
            "country_code": (address.get("country_code") or "").upper() or None,
        }
        if name
        else None
    )

    if len(_place_cache) >= _PLACE_CACHE_SIZE:
        _place_cache.clear()
    _place_cache[key] = place

    return place


def clear_place_cache() -> None:
    _place_cache.clear()
