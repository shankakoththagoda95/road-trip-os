from app.schemas.route import RoutePreference

import httpx


OSRM_URL = "https://router.project-osrm.org/route/v1/driving"


def calculate_route(
    start_latitude: float,
    start_longitude: float,
    end_latitude: float,
    end_longitude: float,
) -> dict:
    """
    Calculate a driving route between two coordinates.
    """

    coordinates = (
        f"{start_longitude},{start_latitude};"
        f"{end_longitude},{end_latitude}"
    )

    url = f"{OSRM_URL}/{coordinates}"

    params = {
        "overview": "false",
    }

    response = httpx.get(
        url,
        params=params,
        timeout=10,
    )

    response.raise_for_status()

    data = response.json()

    if data.get("code") != "Ok":
        raise ValueError("Route could not be calculated")

    route = data["routes"][0]

    return {
            "distance_meters": route["distance"],
            "duration_seconds": route["duration"],
            "legs": [
                {
                    "distance_meters": leg["distance"],
                    "duration_seconds": leg["duration"],
                }
                for leg in route["legs"]
            ],
    }


def calculate_multi_stop_route(
    coordinates: list[tuple[float, float]],
    preference: RoutePreference,
) -> dict:
    """
    Calculate a driving route through multiple coordinates.

    Coordinates must be provided as:
    (latitude, longitude)
    """
    if preference != RoutePreference.FASTEST:
        raise ValueError(
            "Shortest routing is not implemented yet"
        )

    if len(coordinates) < 2:
        raise ValueError(
            "At least two coordinates are required"
        )

    coordinate_string = ";".join(
        f"{longitude},{latitude}"
        for latitude, longitude in coordinates
    )

    url = f"{OSRM_URL}/{coordinate_string}"

    params = {
        "overview": "false",
    }

    response = httpx.get(
        url,
        params=params,
        timeout=10,
    )

    response.raise_for_status()

    data = response.json()

    if data.get("code") != "Ok":
        raise ValueError(
            "Route could not be calculated"
        )

    route = data["routes"][0]

    return {
        "distance_meters": route["distance"],
        "duration_seconds": route["duration"],
        "legs": [
            {
                "distance_meters": leg["distance"],
                "duration_seconds": leg["duration"],
            }
            for leg in route["legs"]
        ],
    }