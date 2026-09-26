from datetime import date, datetime, timedelta

import httpx

from app.integrations.elevation import ElevationProvider
from app.integrations.weather import WeatherProvider
from app.services.energy_stops import cumulative_distances, point_at_distance
from app.services.terrain import calculate_terrain_summary


# Open-Meteo allows up to 100 coordinates per elevation request.
ELEVATION_SAMPLES = 100

# Open-Meteo daily forecasts reach 16 days ahead (today + 15).
FORECAST_DAYS = 16

FREEZING_C = 0.0
STRONG_WIND_KMH = 50.0
HIGH_ELEVATION_M = 1500.0

# WMO weather codes.
FOG_CODES = {45, 48}
SNOW_CODES = {71, 73, 75, 77, 85, 86}
HEAVY_RAIN_CODES = {65, 67, 82}
THUNDERSTORM_CODES = {95, 96, 99}


def sample_route(
    coordinates: list[tuple[float, float]],
    samples: int = ELEVATION_SAMPLES,
) -> list[tuple[float, float, float]]:
    """
    Evenly spaced (distance_km, latitude, longitude) points along a route
    of (latitude, longitude) pairs.
    """

    distances = cumulative_distances(coordinates)
    total_km = distances[-1]
    count = max(2, min(samples, len(coordinates)))

    points = []

    for index in range(count):
        distance_km = total_km * index / (count - 1)
        latitude, longitude = point_at_distance(
            coordinates,
            distances,
            distance_km,
        )
        points.append((distance_km, latitude, longitude))

    return points


def arrival_dates(
    departure_at: datetime,
    leg_durations_seconds: list[float],
    max_driving_hours_per_day: float | None,
    stay_nights: list[int] | None = None,
) -> list[date]:
    """
    Estimated date at each route point (start, then the end of every leg).

    Without a daily limit the drive is continuous. With one, driving
    continues on the next day once the day's hours are used up. After a
    place with N nights (`stay_nights`, one per leg), driving resumes N days
    later at the original departure time.
    """

    # One per leg; missing entries mean driving straight on.
    nights = list(stay_nights or []) + [0] * len(leg_durations_seconds)
    dates = [departure_at.date()]
    # When the current stretch of driving started.
    set_off = departure_at
    driven_seconds = 0.0

    for duration, stay in zip(leg_durations_seconds, nights):
        driven_seconds += duration

        if max_driving_hours_per_day:
            limit_seconds = max_driving_hours_per_day * 3600
            # A leg ending exactly at the limit still arrives that day.
            day_offset = max(0, int((driven_seconds - 1) // limit_seconds))
            arrival_date = set_off.date() + timedelta(days=day_offset)
        else:
            arrival_date = (set_off + timedelta(seconds=driven_seconds)).date()

        dates.append(arrival_date)

        if stay > 0:
            set_off = datetime.combine(
                arrival_date + timedelta(days=stay),
                departure_at.time(),
            )
            driven_seconds = 0.0

    return dates


def condition_warnings(
    weather: list[dict],
    terrain: dict | None,
) -> list[str]:
    """
    Human-readable warnings for forecasts and terrain along the route.
    """

    warnings = []

    for entry in weather:
        forecast = entry["forecast"]

        if forecast is None:
            continue

        place = f"{entry['location']} ({entry['date'].strftime('%a %d %b')})"
        code = forecast["weather_code"]

        if code in THUNDERSTORM_CODES:
            warnings.append(f"Thunderstorms forecast at {place}")
        elif code in SNOW_CODES:
            warnings.append(f"Snow forecast at {place}")
        elif code in HEAVY_RAIN_CODES:
            warnings.append(f"Heavy rain forecast at {place}")
        elif code in FOG_CODES:
            warnings.append(f"Fog forecast at {place}")

        if (
            forecast["temperature_min_c"] <= FREEZING_C
            and code not in SNOW_CODES
        ):
            warnings.append(
                f"Freezing temperatures at {place}: watch for ice"
            )

        if forecast["wind_speed_max_kmh"] >= STRONG_WIND_KMH:
            warnings.append(
                f"Strong wind ({round(forecast['wind_speed_max_kmh'])} km/h) "
                f"at {place}"
            )

    if terrain and terrain["max_elevation_m"] >= HIGH_ELEVATION_M:
        warnings.append(
            f"The route climbs to {round(terrain['max_elevation_m'])} m: "
            "mountain roads may be closed or need winter equipment"
        )

    return warnings


def build_route_conditions(
    route: dict,
    departure_at: datetime,
    max_driving_hours_per_day: float | None,
    weather_provider: WeatherProvider,
    elevation_provider: ElevationProvider,
    today: date,
    stay_nights: list[int] | None = None,
) -> dict:
    """
    Weather at each route point on the day it's reached, plus a terrain
    summary and elevation profile. Each part degrades independently when
    its data source is unavailable.

    `route` is a route preview (see services/route_preview.py).
    """

    unavailable: list[str] = []

    # --- Weather ---
    points = list(route["points"])

    # Round trips end back at the start.
    if len(route["legs"]) == len(points):
        points.append({**points[0], "kind": "start"})

    dates = arrival_dates(
        departure_at,
        [leg["duration_seconds"] for leg in route["legs"]],
        max_driving_hours_per_day,
        stay_nights,
    )
    last_forecast_day = today + timedelta(days=FORECAST_DAYS - 1)

    weather = []

    for point, point_date in zip(points, dates):
        forecast = None

        if today <= point_date <= last_forecast_day:
            try:
                daily = weather_provider.get_daily_forecast(
                    latitude=point["latitude"],
                    longitude=point["longitude"],
                    forecast_date=point_date,
                )
                forecast = {
                    "temperature_max_c": daily.temperature_max_c,
                    "temperature_min_c": daily.temperature_min_c,
                    "precipitation_probability": (
                        daily.precipitation_probability
                    ),
                    "wind_speed_max_kmh": daily.wind_speed_max_kmh,
                    "weather_code": daily.weather_code,
                }
            except (httpx.HTTPError, KeyError, IndexError, TypeError):
                if "weather" not in unavailable:
                    unavailable.append("weather")

        weather.append(
            {
                "location": point["location"],
                "kind": point["kind"],
                "latitude": point["latitude"],
                "longitude": point["longitude"],
                "date": point_date,
                "forecast_available": forecast is not None,
                "forecast": forecast,
            }
        )

    # --- Terrain ---
    coordinates = [
        (latitude, longitude)
        for longitude, latitude in route["geometry"]["coordinates"]
    ]
    samples = sample_route(coordinates)

    terrain = None
    elevation_profile = []

    try:
        elevations = elevation_provider.get_elevations(
            [(latitude, longitude) for _, latitude, longitude in samples],
        )
        elevations_m = [point.elevation_m for point in elevations]

        summary = calculate_terrain_summary(elevations_m)
        terrain = {
            "total_ascent_m": summary.total_ascent_m,
            "total_descent_m": summary.total_descent_m,
            "max_elevation_m": summary.max_elevation_m,
            "min_elevation_m": summary.min_elevation_m,
            "elevation_range_m": summary.elevation_range_m,
        }
        elevation_profile = [
            {"distance_km": distance_km, "elevation_m": elevation_m}
            for (distance_km, _, _), elevation_m in zip(
                samples,
                elevations_m,
            )
        ]
    except (httpx.HTTPError, KeyError, ValueError):
        unavailable.append("elevation")

    return {
        "weather": weather,
        "terrain": terrain,
        "elevation_profile": elevation_profile,
        "warnings": condition_warnings(weather, terrain),
        "unavailable": unavailable,
    }
