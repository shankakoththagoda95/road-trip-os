from math import atan2, cos, radians, sin, sqrt


EARTH_RADIUS_KM = 6371.0


def calculate_distance_km(
    latitude_1: float,
    longitude_1: float,
    latitude_2: float,
    longitude_2: float,
) -> float:
    """
    Calculate the approximate distance between two geographic
    coordinates using the Haversine formula.
    """

    latitude_1 = radians(latitude_1)
    longitude_1 = radians(longitude_1)
    latitude_2 = radians(latitude_2)
    longitude_2 = radians(longitude_2)

    delta_latitude = latitude_2 - latitude_1
    delta_longitude = longitude_2 - longitude_1

    a = (
        sin(delta_latitude / 2) ** 2
        + cos(latitude_1)
        * cos(latitude_2)
        * sin(delta_longitude / 2) ** 2
    )

    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return EARTH_RADIUS_KM * c