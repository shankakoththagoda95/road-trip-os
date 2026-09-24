import httpx


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"


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


def geocode_location(location: str) -> tuple[float, float]:
    """
    Convert a location name into latitude and longitude.
    """

    result = search_location(location)

    return (
        result["latitude"],
        result["longitude"],
    )
